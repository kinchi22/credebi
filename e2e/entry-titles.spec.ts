import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  AMOUNT,
  DAY,
  deleteListed,
  entries,
  entryForm,
  expectOffered,
  headingShowing,
  listedEntry,
  MEMO_MAX,
  offeredTitle,
  openEntryForm,
  offeredTitles,
  openEditEntry,
  titleList,
  openTitleField,
  postEntries,
  saveEdit,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  titleField,
  TITLE_MAX,
  titled,
  twoLine,
  type Heading,
} from './entries';
import { BOOKS_OPEN } from './accounts';
import { closeDialog, discardDialog } from './dialog';
import { signIn } from './session';
import { type EntryFormMode } from './settings';
import { expectWithinPhone, PHONE } from './viewport';

async function postInMode(
  form: Locator,
  mode: EntryFormMode,
  heading: Heading,
): Promise<void> {
  if (mode === 'Two-line mode') {
    await submitTwoLineEntry(form, twoLine(heading));
    return;
  }
  await submitMultiLineEntry(form, {
    ...heading,
    lines: [
      { side: 'Debit', account: 'Food', amount: AMOUNT },
      { side: 'Credit', account: 'Cash', amount: AMOUNT },
    ],
  });
}

async function expectTitleBeforeMemo(form: Locator): Promise<void> {
  const inDocumentOrder = titleField(form).or(form.getByLabel('Memo', { exact: true }));
  await expect(inDocumentOrder).toHaveCount(2);
  await expect(inDocumentOrder.nth(0)).toHaveAccessibleName('Title');
  await expect(inDocumentOrder.nth(1)).toHaveAccessibleName('Memo');
}

const TOO_LONG_TITLE = 'T'.repeat(TITLE_MAX + 1);

const tooLongMemo = (): string => `Too long a memo ${randomUUID()} `.padEnd(MEMO_MAX + 1, 'M');

const naming = (limit: number): RegExp => new RegExp(`(?<!\\d)${String(limit)}(?!\\d)`);

async function expectTitleRefused(scope: Locator): Promise<void> {
  const refusal = scope.getByRole('alert');
  await expect(refusal).toContainText(/title/i);
  await expect(refusal).toContainText(naming(TITLE_MAX));
  await expect(refusal).not.toContainText(/memo/i);
}

async function expectMemoRefused(scope: Locator): Promise<void> {
  const refusal = scope.getByRole('alert');
  await expect(refusal).toContainText(/memo/i);
  await expect(refusal).toContainText(naming(MEMO_MAX));
  await expect(refusal).not.toContainText(/title/i);
}

const HEADINGS = [
  { day: '2026-09-11', title: 'Starbucks', memo: 'Dinner with John; I paid first' },
  { day: '2026-09-12', title: 'Salary', memo: '' },
  { day: '2026-09-13', title: '', memo: 'Paid back by Jane' },
  { day: '2026-09-14', title: '', memo: '' },
] as const;

async function expectEachListed(page: Page): Promise<void> {
  for (const heading of HEADINGS) {
    const entry = listedEntry(page, heading.day);
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(headingShowing(heading));
  }
}

for (const mode of ['Two-line mode', 'Multi-line mode'] as const) {
  test(`posts an Entry in ${mode} with a Title and a memo, a Title alone, a memo alone or neither, and lists each with its Title before its memo, after a reload too`, async ({ page }) => {
    test.slow();
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    await expect(titleField(form)).toBeVisible();
    await expectTitleBeforeMemo(form);
    for (const heading of HEADINGS) {
      await postInMode(form, mode, heading);
      await expect(listedEntry(page, heading.day)).toHaveCount(1);
    }
    await expectEachListed(page);

    await page.reload();
    await expectEachListed(page);
  });

  test(`refuses a Title longer than ${String(TITLE_MAX)} characters in ${mode} with a message naming the Title and its limit, and posts one of ${String(TITLE_MAX)} characters outside the Basic Multilingual Plane`, async ({ page }) => {
    const memo = `Too long a name ${randomUUID()}`;
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    await postInMode(form, mode, { day: DAY, title: TOO_LONG_TITLE, memo });
    await expectTitleRefused(form);
    await page.reload();
    await expect(listedEntry(page, memo)).toHaveCount(0);

    const longest = '\u{1F600}'.repeat(TITLE_MAX);
    await postInMode(entryForm(page), mode, { day: DAY, title: longest, memo });
    const entry = listedEntry(page, memo);
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(headingShowing({ day: DAY, title: longest, memo }));
  });

  test(`refuses a memo longer than ${String(MEMO_MAX)} characters in ${mode} with a message naming the memo and its limit`, async ({ page }) => {
    const memo = tooLongMemo();
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    await postInMode(form, mode, { day: DAY, title: 'Salary', memo });
    await expectMemoRefused(form);

    await page.reload();
    await expect(entries(page)).toBeVisible();
    await expect(listedEntry(page, memo)).toHaveCount(0);
  });

  test(`refuses a Title and a memo both too long in ${mode} with the Title's refusal, and with the memo's once the Title is shortened`, async ({ page }) => {
    const memo = tooLongMemo();
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    await postInMode(form, mode, { day: DAY, title: TOO_LONG_TITLE, memo });
    await expectTitleRefused(form);

    await titleField(form).fill('Salary');
    await submit(form);
    await expectMemoRefused(form);

    await page.reload();
    await expect(entries(page)).toBeVisible();
    await expect(listedEntry(page, memo)).toHaveCount(0);
  });
}

test('trims a Title of surrounding spaces, and posts a Title of only spaces as none', async ({ page }) => {
  const run = randomUUID();
  const trimmed = `Trimmed ${run}`;
  const blank = `Blank ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('  Salary  ', trimmed), titled('   ', blank)]);

  await page.goto('/entries');
  await expect(listedEntry(page, trimmed)).toContainText(headingShowing({ day: DAY, title: 'Salary', memo: trimmed }));
  await expect(listedEntry(page, blank)).toContainText(headingShowing({ day: DAY, title: '', memo: blank }));

  const dialog = await openEditEntry(listedEntry(page, trimmed));
  await expect(titleField(dialog)).toHaveValue('Salary');
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();

  await openTitleField(titleField(entryForm(page)));
  await expectOffered(page, ['Salary']);
});

test("offers every Title of the User's Entries when the empty Title field is opened, the most recently posted first whatever its day, and Titles differing only in case once, spelled as on the latest", async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Starbucks', `First coffee ${run}`, '2026-09-15'),
    titled('Salary', `Pay ${run}`, '2026-09-10'),
    titled('Rent', `Flat ${run}`, '2026-09-20'),
    titled('starbucks', `Second coffee ${run}`, '2026-09-01'),
  ]);

  for (const mode of ['Two-line mode', 'Multi-line mode'] as const) {
    const form = await openEntryForm(page, mode);
    await openTitleField(titleField(form));
    await expectOffered(page, ['starbucks', 'Rent', 'Salary']);
  }
});

test('narrows the offered Titles to those containing the typed text, ignoring case, fills the Title from the one chosen, and takes a Title none offers', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const chosen = `Chosen ${run}`;
  const typed = `Typed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Starbucks', `Coffee ${run}`),
    titled('Salary', `Pay ${run}`),
    titled('Rent', `Flat ${run}`),
  ]);

  const form = await openEntryForm(page, 'Two-line mode');
  const field = titleField(form);
  await field.click();
  await field.fill('AR');
  await expectOffered(page, ['Salary', 'Starbucks']);
  await field.fill('bucks');
  await expectOffered(page, ['Starbucks']);
  await field.fill('Bakery');
  await expectOffered(page, []);

  await field.fill('sal');
  await offeredTitle(page, 'Salary').click();
  await expect(field).toHaveValue('Salary');
  await submitTwoLineEntry(form, twoLine({ day: DAY, memo: chosen }));
  await expect(listedEntry(page, chosen)).toContainText(headingShowing({ day: DAY, title: 'Salary', memo: chosen }));

  await submitTwoLineEntry(entryForm(page), titled('Bakery', typed));
  await expect(listedEntry(page, typed)).toContainText(headingShowing({ day: DAY, title: 'Bakery', memo: typed }));

  await page.reload();
  await openTitleField(titleField(entryForm(page)));
  await expectOffered(page, ['Bakery', 'Salary', 'Rent', 'Starbucks']);
});

test('stops offering a Title once every Entry carrying it is deleted or corrected away', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const misspelt = `Misspelt ${run}`;
  const doomed = `Doomed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Strabucks', misspelt),
    titled('Gone', doomed),
    titled('Kept', `Kept ${run}`),
  ]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, misspelt));
  await titleField(dialog).fill('Starbucks');
  await saveEdit(dialog);
  await deleteListed(listedEntry(page, doomed));

  await page.reload();
  await openTitleField(titleField(entryForm(page)));
  await expectOffered(page, ['Starbucks', 'Kept']);
});

test("never offers one User's Titles to another", async ({ browser }) => {
  const owner = await browser.newContext();
  const other = await browser.newContext();
  try {
    const ownerPage = await owner.newPage();
    await signIn(ownerPage, { accountsStartOn: BOOKS_OPEN });
    await postEntries(ownerPage, [titled('Secret', `Private ${randomUUID()}`)]);

    const otherPage = await other.newPage();
    await signIn(otherPage, { accountsStartOn: BOOKS_OPEN });
    await postEntries(otherPage, [titled('Mine', `Own ${randomUUID()}`)]);

    await otherPage.goto('/entries');
    await openTitleField(titleField(entryForm(otherPage)));
    await expectOffered(otherPage, ['Mine']);
  } finally {
    await owner.close();
    await other.close();
  }
});

test('fills Edit entry with the Title and memo, and offers the Titles as the entry form does', async ({ page }) => {
  const run = randomUUID();
  const memo = `Latte ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', memo), titled('Salary', `Pay ${run}`)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  const field = titleField(dialog);
  await expect(field).toHaveValue('Starbucks');
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);

  await openTitleField(field);
  await expectOffered(page, ['Salary', 'Starbucks']);
  await field.fill('BUCK');
  await expectOffered(page, ['Starbucks']);
  await offeredTitle(page, 'Starbucks').click();
  await expect(field).toHaveValue('Starbucks');
});

test('saves a change to the Title alone as an edit, a change of case included', async ({ page }) => {
  const run = randomUUID();
  const memo = `Latte ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('starbucks', memo)]);

  await page.goto('/entries');
  const entry = listedEntry(page, memo);
  const recased = await openEditEntry(entry);
  await titleField(recased).fill('Starbucks');
  await saveEdit(recased);
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));

  const renamed = await openEditEntry(entry);
  await titleField(renamed).fill('Blue Bottle');
  await saveEdit(renamed);
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(headingShowing({ day: DAY, title: 'Blue Bottle', memo }));

  await page.reload();
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(headingShowing({ day: DAY, title: 'Blue Bottle', memo }));
  await openTitleField(titleField(entryForm(page)));
  await expectOffered(page, ['Blue Bottle']);
});

test('saves clearing the Title or the memo as an edit', async ({ page }) => {
  test.slow();
  const untitledDay = '2026-09-11';
  const memoLessDay = '2026-09-12';
  const memo = `Dinner with John ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('Dining out', memo, untitledDay),
    titled('Rent', `Flat ${randomUUID()}`, memoLessDay),
  ]);

  await page.goto('/entries');
  const untitled = await openEditEntry(listedEntry(page, untitledDay));
  await titleField(untitled).fill('');
  await saveEdit(untitled);

  const memoLess = await openEditEntry(listedEntry(page, memoLessDay));
  await memoLess.getByLabel('Memo').fill('');
  await saveEdit(memoLess);

  for (const reloaded of [false, true]) {
    if (reloaded) await page.reload();
    await expect(listedEntry(page, untitledDay)).toHaveCount(1);
    await expect(listedEntry(page, untitledDay)).toContainText(headingShowing({ day: untitledDay, memo }));
    await expect(listedEntry(page, memoLessDay)).toHaveCount(1);
    await expect(listedEntry(page, memoLessDay)).toContainText(headingShowing({ day: memoLessDay, title: 'Rent', memo: '' }));
  }

  await openTitleField(titleField(entryForm(page)));
  await expectOffered(page, ['Rent']);
});

test('closes Edit entry on Save with the Title and memo unchanged, and lists the Entry once, unchanged', async ({ page }) => {
  const memo = `Unchanged ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Salary', memo)]);

  await page.goto('/entries');
  await saveEdit(await openEditEntry(listedEntry(page, memo)));

  await page.reload();
  await expect(page.getByTestId('entry')).toHaveCount(1);
  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Salary', memo }));
});

test('edits an Entry with an empty memo, and keeps its memo empty', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const form = await openEntryForm(page, 'Two-line mode');
  await submitTwoLineEntry(form, titled('Groceries', ''));
  const entry = listedEntry(page, DAY);
  await expect(entry).toContainText(headingShowing({ day: DAY, title: 'Groceries', memo: '' }));

  const dialog = await openEditEntry(entry);
  await expect(titleField(dialog)).toHaveValue('Groceries');
  await expect(dialog.getByLabel('Memo')).toHaveValue('');
  await dialog.getByLabel('Amount').fill('8000');
  await saveEdit(dialog);

  await page.reload();
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(headingShowing({ day: DAY, title: 'Groceries', memo: '' }, '8,000'));
});

test(`refuses a Title longer than ${String(TITLE_MAX)} characters in Edit entry with a message naming the Title and its limit, keeping the dialog open and the Entry unchanged`, async ({ page }) => {
  const memo = `Latte ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await titleField(dialog).fill(TOO_LONG_TITLE);
  await submit(dialog, 'Save');

  await expectTitleRefused(dialog);
  await expect(dialog).toBeVisible();

  await page.reload();
  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));
});

test(`refuses a memo longer than ${String(MEMO_MAX)} characters in Edit entry with a message naming the memo and its limit, keeping the dialog open and the Entry unchanged`, async ({ page }) => {
  const memo = `Latte ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await dialog.getByLabel('Memo').fill(tooLongMemo());
  await submit(dialog, 'Save');

  await expectMemoRefused(dialog);
  await expect(dialog).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('entry')).toHaveCount(1);
  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));
});

test("refuses a Title and a memo both too long in Edit entry with the Title's refusal, and with the memo's once the Title is shortened, keeping the Entry unchanged", async ({ page }) => {
  const memo = `Latte ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await titleField(dialog).fill(TOO_LONG_TITLE);
  await dialog.getByLabel('Memo').fill(tooLongMemo());
  await submit(dialog, 'Save');
  await expectTitleRefused(dialog);

  await titleField(dialog).fill('Blue Bottle');
  await submit(dialog, 'Save');
  await expectMemoRefused(dialog);
  await expect(dialog).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('entry')).toHaveCount(1);
  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));
});

test('offers the Titles at 390px within the screen, and posts the Title chosen from them', async ({ page }) => {
  const run = randomUUID();
  const memo = `On the phone ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', `Coffee ${run}`), titled('Salary', `Pay ${run}`)]);

  await page.setViewportSize(PHONE);
  await page.goto('/entries');
  const form = entryForm(page);
  const field = titleField(form);
  await expect(field).toBeVisible();
  await openTitleField(field);
  await expectOffered(page, ['Salary', 'Starbucks']);
  for (const option of await offeredTitles(page).all()) {
    await expectWithinPhone(page, option);
  }

  await offeredTitle(page, 'Starbucks').click();
  await expect(field).toHaveValue('Starbucks');
  await form.getByLabel('Date').fill(DAY);
  await form.getByLabel('Memo').fill(memo);
  await submit(form);

  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));
});

test('chooses no offered Title, keeps the list open and posts nothing when Enter or Escape is pressed while a Title is being composed', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', `Coffee ${run}`), titled('Salary', `Pay ${run}`)]);

  const form = await openEntryForm(page, 'Two-line mode');
  const field = titleField(form);
  const salary = offeredTitle(page, 'Salary');
  await openTitleField(field);
  await field.fill('Sa');
  await expectOffered(page, ['Salary']);
  await field.press('ArrowDown');
  await expect(salary).toHaveAttribute('aria-selected', 'true');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'l', selectionStart: 1, selectionEnd: 1 });
  await expect(field).toHaveValue('Sal');
  await expectOffered(page, ['Salary']);
  await expect(salary).toHaveAttribute('aria-selected', 'true');

  for (const key of ['Enter', 'Escape']) {
    await page.keyboard.press(key);
    await expect(titleList(page)).toBeVisible();
    await expect(field).toHaveValue('Sal');
    await expect(form.getByRole('alert')).toHaveCount(0);
  }

  await cdp.send('Input.insertText', { text: 'l' });
  await expect(field).toHaveValue('Sal');
  await expectOffered(page, ['Salary']);
  await expect(form.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('entry')).toHaveCount(2);
});

test('keeps Edit entry open, asks nothing and saves nothing when Enter or Escape is pressed while a Title is being composed in it', async ({ page }) => {
  const run = randomUUID();
  const memo = `Coffee ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', memo), titled('Salary', `Pay ${run}`)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  const field = titleField(dialog);
  await openTitleField(field);
  await field.fill('Sa');
  await expectOffered(page, ['Salary']);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'l', selectionStart: 1, selectionEnd: 1 });
  await expect(field).toHaveValue('Sal');

  for (const key of ['Escape', 'Enter']) {
    await page.keyboard.press(key);
    await expect(dialog).toBeVisible();
    await expect(discardDialog(page)).toHaveCount(0);
    await expect(titleList(page)).toBeVisible();
    await expect(field).toHaveValue('Sal');
  }

  await cdp.send('Input.insertText', { text: 'l' });
  await expect(field).toHaveValue('Sal');
  await expect(dialog).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(listedEntry(page, memo)).toContainText(headingShowing({ day: DAY, title: 'Starbucks', memo }));
});
