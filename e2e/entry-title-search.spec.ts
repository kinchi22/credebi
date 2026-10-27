import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  DAY,
  deleteListed,
  entryForm,
  entrySearchForm,
  expectOffered,
  headingShowing,
  listedEntry,
  offeredTitle,
  openEditEntry,
  openTitleField,
  postEntries,
  saveEdit,
  submitTwoLineEntry,
  titleField,
  TITLE_MAX,
  titled,
} from './entries';
import { EARLIEST, fromField, LATEST, resultFor, results, search, toField } from './entry-search';
import { ENTRY_SEARCH_PATH as SEARCH, ENTRY_SEARCH_WITH_QUERY, queryOf } from './routes';
import { BOOKS_OPEN } from './accounts';
import { signIn } from './session';
import { setEntryFormMode } from './settings';

test('finds every Entry whose Title is the Title criterion, ignoring case, and none whose Title only contains it or whose memo holds it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const latte = `Latte ${run}`;
  const beans = `Beans ${run}`;
  const reserve = `Reserve roast ${run}`;
  const mug = `Starbucks mug ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Starbucks', latte),
    titled('STARBUCKS', beans),
    titled('Starbucks Reserve', reserve),
    titled('', mug),
  ]);

  await page.goto(SEARCH);
  await search(page, { title: 'starbucks' });

  await expect(resultFor(page, latte)).toHaveCount(1);
  await expect(resultFor(page, latte)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo: latte }));
  await expect(resultFor(page, beans)).toHaveCount(1);
  await expect(resultFor(page, beans)).toContainText(headingShowing({ day: DAY, title: 'STARBUCKS', memo: beans }));
  await expect(resultFor(page, reserve)).toHaveCount(0);
  await expect(resultFor(page, mug)).toHaveCount(0);
});

test('shows an Entry in the results with its Title before its memo, and nothing for an absent Title or memo', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const both = `Both ${run}`;
  const memoOnly = `Memo only ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Rent', both, '2026-06-10'),
    titled('', memoOnly, '2026-06-11'),
  ]);
  const titleOnlyDay = '2026-06-12';
  await setEntryFormMode(page, 'Two-line mode');
  await page.goto('/entries');
  await submitTwoLineEntry(entryForm(page), titled('Salary', '', titleOnlyDay));
  await expect(listedEntry(page, titleOnlyDay)).toHaveCount(1);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30' });

  await expect(resultFor(page, both)).toContainText(headingShowing({ day: '2026-06-10', title: 'Rent', memo: both }));
  await expect(resultFor(page, memoOnly)).toContainText(headingShowing({ day: '2026-06-11', title: '', memo: memoOnly }));
  const salary = resultFor(page, titleOnlyDay);
  await expect(salary).toHaveCount(1);
  await expect(salary).toContainText(headingShowing({ day: titleOnlyDay, title: 'Salary', memo: '' }));
});

test('matches the Title criterion literally, so a % or _ in it is a character to find', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const percent = `Percent ${run}`;
  const digit = `Digit ${run}`;
  const underscore = `Underscore ${run}`;
  const letter = `Letter ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('100% juice', percent),
    titled('1000 juice', digit),
    titled('a_b', underscore),
    titled('axb', letter),
  ]);

  await page.goto(SEARCH);
  await search(page, { title: '100% juice' });
  await expect(resultFor(page, percent)).toHaveCount(1);
  await expect(resultFor(page, digit)).toHaveCount(0);

  await search(page, { title: 'a_b' });
  await expect(resultFor(page, underscore)).toHaveCount(1);
  await expect(resultFor(page, letter)).toHaveCount(0);
});

test('narrows with the Title, the day range, the Account and the memo together, each excluding an Entry the others match', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const matching = `June ${run}`;
  const wrongDay = `June paid late ${run}`;
  const wrongAccount = `June on account ${run}`;
  const wrongMemo = `Deposit ${run}`;
  const wrongTitle = `June fuel ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Rent', matching, '2026-06-15'),
    titled('Rent', wrongDay, '2026-07-15'),
    titled('Rent', wrongAccount, '2026-06-15', 'Credit card payable'),
    titled('Rent', wrongMemo, '2026-06-15'),
    titled('Fuel', wrongTitle, '2026-06-15'),
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'Cash', title: 'rent', memo: 'june' });

  await expect(resultFor(page, matching)).toHaveCount(1);
  for (const unmatched of [wrongDay, wrongAccount, wrongMemo, wrongTitle]) {
    await expect(resultFor(page, unmatched)).toHaveCount(0);
  }
});

test('matches every Entry, with a Title or without, when the Title criterion is empty', async ({ page }) => {
  const run = randomUUID();
  const withTitle = `With title ${run}`;
  const withoutTitle = `Without title ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Salary', withTitle), titled('', withoutTitle)]);

  await page.goto(SEARCH);
  await search(page, { title: '', memo: run });

  await expect(resultFor(page, withTitle)).toHaveCount(1);
  await expect(resultFor(page, withoutTitle)).toHaveCount(1);
});

test('never matches the memo criterion against a Title', async ({ page }) => {
  const run = randomUUID();
  const memo = `Card ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Birthday gift', memo)]);

  await page.goto(SEARCH);
  await search(page, { memo: 'birthday' });

  await expect(results(page)).toContainText(/match/i);
  await expect(resultFor(page, memo)).toHaveCount(0);
});

test("offers the User's Titles in the Title criterion, keeps the one searched with in the URL, and refills it after a reload", async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const pay = `Pay ${run}`;
  const flat = `Flat ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Salary', pay), titled('Rent', flat)]);

  await page.goto(SEARCH);
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();
  await fromField(page).fill(EARLIEST);
  await toField(page).fill(LATEST);

  const field = titleField(form);
  await openTitleField(field);
  await expectOffered(page, ['Rent', 'Salary']);
  await field.fill('SAL');
  await expectOffered(page, ['Salary']);
  await offeredTitle(page, 'Salary').click();
  await expect(field).toHaveValue('Salary');
  await form.getByRole('button', { name: 'Search' }).click();

  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
  expect(queryOf(page).get('title')).toBe('Salary');
  await expect(resultFor(page, pay)).toHaveCount(1);
  await expect(resultFor(page, flat)).toHaveCount(0);

  await page.reload();
  await expect(titleField(entrySearchForm(page))).toHaveValue('Salary');
  await expect(resultFor(page, pay)).toHaveCount(1);
  await expect(resultFor(page, flat)).toHaveCount(0);
});

test('refuses a Title criterion longer than a Title can be, naming the Title, and shows no list', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Salary', `Pay ${randomUUID()}`)]);

  await page.goto(SEARCH);
  await search(page, { title: 'T'.repeat(TITLE_MAX + 1) });

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/title/i);
  await expect(results(page)).toHaveCount(0);

  await search(page, { title: '\u{1F600}'.repeat(TITLE_MAX) });
  await expect(results(page)).toContainText(/match/i);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('never finds a deleted Entry or an Entry edited to another Title by its Title', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const renamed = `Renamed ${run}`;
  const doomed = `Doomed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Coffee', renamed), titled('Coffee', doomed)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, renamed));
  await titleField(dialog).fill('Tea');
  await saveEdit(dialog);
  await deleteListed(listedEntry(page, doomed));

  await page.goto(SEARCH);
  await search(page, { title: 'coffee' });
  await expect(results(page)).toContainText(/match/i);
  await expect(results(page).getByTestId('entry')).toHaveCount(0);

  await search(page, { title: 'tea' });
  await expect(resultFor(page, renamed)).toHaveCount(1);
});
