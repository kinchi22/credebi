import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  accountTicks,
  amountShown,
  AMOUNT,
  DAY,
  entryForm,
  entrySearchForm,
  lineGroup,
  lineGroups,
  listedEntry,
  postEntries,
  submitMultiLineEntry,
  TWELVE_THOUSAND_FIVE_HUNDRED,
  type MultiLineEntry,
  type TwoLineEntry,
} from './entries';
import { resultFor, results, search } from './entry-search';
import { ENTRY_SEARCH_PATH as SEARCH, ENTRY_SEARCH_WITH_QUERY } from './routes';
import { signIn } from './session';
import { setEntryFormMode } from './settings';
import { PHONE } from './viewport';

const EDITED_DAY = '2026-09-20';

const entries = (page: Page): Locator => page.getByRole('region', { name: 'Entries' });

const entriesOf = (scope: Page | Locator, run: string): Locator =>
  scope.getByTestId('entry').filter({ hasText: run });

const editButton = (entry: Locator): Locator =>
  entry.getByRole('button', { name: 'Edit', exact: true });

const deleteButton = (entry: Locator): Locator =>
  entry.getByRole('button', { name: 'Delete', exact: true });

const editDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Edit entry', exact: true });

const deleteDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Delete entry', exact: true });

const discardDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Discard changes', exact: true });

const button = (scope: Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

const twoLine = (day: string, memo: string): TwoLineEntry => ({
  day,
  memo,
  debitAccount: 'Expenses',
  creditAccount: 'Cash',
  amount: AMOUNT,
});

async function openEdit(entry: Locator): Promise<Locator> {
  await editButton(entry).click();
  const dialog = editDialog(entry.page());
  await expect(dialog).toBeVisible();
  return dialog;
}

async function save(dialog: Locator): Promise<void> {
  await button(dialog, 'Save').click();
  await expect(dialog).toBeHidden();
}

async function deleteListed(entry: Locator): Promise<void> {
  const page = entry.page();
  await deleteButton(entry).click();
  const dialog = deleteDialog(page);
  await expect(dialog).toBeVisible();
  await button(dialog, 'Delete').click();
  await expect(dialog).toBeHidden();
}

async function rewriteTwoLine(dialog: Locator, memo: string): Promise<void> {
  await dialog.getByLabel('Date').fill(EDITED_DAY);
  await dialog.getByLabel('Memo').fill(memo);
  await accountChoice(dialog, 'Credit', 'Accounts payable').check();
  await dialog.getByLabel('Amount').fill('8000');
}

async function expectRewritten(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(EDITED_DAY);
  const lines = entry.getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Expenses');
  await expect(lines.nth(1)).toContainText('Accounts payable');
  await expect(entry.getByTestId('entry-total')).toContainText(amountShown('8,000'));
}

async function expectAsPosted(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(DAY);
  const lines = entry.getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Expenses');
  await expect(lines.nth(1)).toContainText('Cash');
  await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
}

async function postMultiLine(page: Page, entry: MultiLineEntry): Promise<void> {
  await setEntryFormMode(page, 'Multi-line mode');
  await page.goto('/entries');
  await submitMultiLineEntry(entryForm(page), entry);
  await expect(listedEntry(page, entry.memo)).toHaveCount(1);
}

async function searchFor(page: Page, memo: string): Promise<void> {
  await page.goto(SEARCH);
  await search(page, { memo });
  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
}

async function expectTwoLineMode(dialog: Locator): Promise<void> {
  await expect(accountChoices(dialog, 'Debit')).toBeVisible();
  await expect(accountChoices(dialog, 'Credit')).toBeVisible();
  await expect(dialog.getByLabel('Amount')).toHaveCount(1);
  await expect(accountTicks(dialog, 'Debit')).toHaveCount(0);
}

async function expectMultiLineMode(dialog: Locator, lines: number): Promise<void> {
  await expect(accountTicks(dialog, 'Debit')).toBeVisible();
  await expect(accountTicks(dialog, 'Credit')).toBeVisible();
  await expect(lineGroups(dialog)).toHaveCount(lines);
  await expect(accountChoices(dialog, 'Debit')).toHaveCount(0);
}

test('holds an Edit and a Delete button in each Entry of the Entry list and of Entry search results', async ({ page }) => {
  const run = randomUUID();
  const memo = `Stationery ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const listed = listedEntry(page, memo);
  await expect(listed).toHaveCount(1);
  await expect(editButton(listed)).toBeVisible();
  await expect(deleteButton(listed)).toBeVisible();

  await searchFor(page, run);
  const found = resultFor(page, memo);
  await expect(found).toHaveCount(1);
  await expect(editButton(found)).toBeVisible();
  await expect(deleteButton(found)).toBeVisible();
});

test('leaves an Entry listed when Delete entry is cancelled, and removes it from the Entry list and Entry search, after a reload too, when it is confirmed', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const doomed = `Posted by mistake ${run}`;
  const kept = `Kept ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, doomed)]);

  await page.goto('/entries');
  const entry = listedEntry(page, doomed);
  await deleteButton(entry).click();
  const dialog = deleteDialog(page);
  await expect(dialog).toBeVisible();
  await button(dialog, 'Cancel').click();
  await expect(dialog).toBeHidden();
  await expectAsPosted(entry);

  await deleteListed(entry);
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(entry).toHaveCount(0);

  await page.reload();
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(entry).toHaveCount(0);

  await searchFor(page, run);
  await expect(resultFor(page, kept)).toHaveCount(1);
  await expect(resultFor(page, doomed)).toHaveCount(0);
});

test('opens Edit entry in Two-line mode, filled with the Entry, for a Two-line mode User and an Entry of one debit and one credit line', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, memo));

  await expectTwoLineMode(dialog);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(accountChoice(dialog, 'Debit', 'Expenses')).toBeChecked();
  await expect(accountChoice(dialog, 'Credit', 'Cash')).toBeChecked();
  await expect(dialog.getByLabel('Amount')).toHaveValue(AMOUNT);
});

test('opens Edit entry in Multi-line mode, filled with every line, for a Two-line mode User and an Entry of more than two lines', async ({ page }) => {
  const memo = `Supplies on account ${randomUUID()}`;
  await signIn(page);
  await postMultiLine(page, {
    day: DAY,
    memo,
    lines: [
      { side: 'Debit', account: 'Expenses', amount: '12500' },
      { side: 'Credit', account: 'Cash', amount: '12000' },
      { side: 'Credit', account: 'Accounts payable', amount: '500' },
    ],
  });
  await setEntryFormMode(page, 'Two-line mode');

  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, memo));

  await expectMultiLineMode(dialog, 3);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineGroup(dialog, 'Debit', 'Expenses').getByLabel('Amount')).toHaveValue('12500');
  await expect(lineGroup(dialog, 'Credit', 'Cash').getByLabel('Amount')).toHaveValue('12000');
  await expect(lineGroup(dialog, 'Credit', 'Accounts payable').getByLabel('Amount')).toHaveValue('500');
});

test('opens Edit entry in Multi-line mode, filled with the Entry, for a Multi-line mode User and an Entry of one debit and one credit line', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, memo)]);
  await setEntryFormMode(page, 'Multi-line mode');

  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, memo));

  await expectMultiLineMode(dialog, 2);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineGroup(dialog, 'Debit', 'Expenses').getByLabel('Amount')).toHaveValue(AMOUNT);
  await expect(lineGroup(dialog, 'Credit', 'Cash').getByLabel('Amount')).toHaveValue(AMOUNT);
});

test('shows only the new version of an edited Entry in the Entry list, after a reload too, and Entry search finds only the new version', async ({ page }) => {
  const run = randomUUID();
  const before = `Before ${run}`;
  const after = `After ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, before)]);

  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, before));
  await rewriteTwoLine(dialog, after);
  await save(dialog);

  await expectRewritten(listedEntry(page, after));
  await expect(entriesOf(page, run)).toHaveCount(1);
  await expect(listedEntry(page, before)).toHaveCount(0);

  await page.reload();
  await expectRewritten(listedEntry(page, after));
  await expect(entriesOf(page, run)).toHaveCount(1);
  await expect(listedEntry(page, before)).toHaveCount(0);

  await searchFor(page, run);
  await expectRewritten(resultFor(page, after));
  await expect(entriesOf(results(page), run)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
});

test('edits an edited Entry again, and deletes it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const second = `Second ${run}`;
  const third = `Third ${run}`;
  const kept = `Kept ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, first)]);

  await page.goto('/entries');
  const once = await openEdit(listedEntry(page, first));
  await once.getByLabel('Memo').fill(second);
  await save(once);
  await expect(listedEntry(page, second)).toHaveCount(1);

  const twice = await openEdit(listedEntry(page, second));
  await expect(twice.getByLabel('Memo')).toHaveValue(second);
  await rewriteTwoLine(twice, third);
  await save(twice);

  await expectRewritten(listedEntry(page, third));
  await expect(entriesOf(page, run)).toHaveCount(2);
  await expect(listedEntry(page, first)).toHaveCount(0);
  await expect(listedEntry(page, second)).toHaveCount(0);

  await deleteListed(listedEntry(page, third));
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(listedEntry(page, third)).toHaveCount(0);

  await page.reload();
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(entriesOf(page, run)).toHaveCount(1);
});

test('closes Edit entry on Save with no change, and lists the Entry once, unchanged', async ({ page }) => {
  const run = randomUUID();
  const memo = `Unchanged ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  await save(await openEdit(listedEntry(page, memo)));

  await expectAsPosted(listedEntry(page, memo));
  await expect(entriesOf(page, run)).toHaveCount(1);

  await page.reload();
  await expectAsPosted(listedEntry(page, memo));
  await expect(entriesOf(page, run)).toHaveCount(1);
});

test('keeps Edit entry open with the input and says the balance is wrong when an edit is Unbalanced', async ({ page }) => {
  const run = randomUUID();
  const memo = `Balanced ${run}`;
  const edited = `Unbalanced ${run}`;
  await signIn(page);
  await postMultiLine(page, {
    day: DAY,
    memo,
    lines: [
      { side: 'Debit', account: 'Expenses', amount: AMOUNT },
      { side: 'Credit', account: 'Cash', amount: AMOUNT },
    ],
  });

  const dialog = await openEdit(listedEntry(page, memo));
  await dialog.getByLabel('Memo').fill(edited);
  await lineGroup(dialog, 'Credit', 'Cash').getByLabel('Amount').fill('12000');
  await button(dialog, 'Save').click();

  await expect(dialog.getByRole('alert')).toContainText(/balance/i);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Memo')).toHaveValue(edited);
  await expect(lineGroup(dialog, 'Credit', 'Cash').getByLabel('Amount')).toHaveValue('12000');

  await page.reload();
  await expectAsPosted(listedEntry(page, memo));
  await expect(listedEntry(page, edited)).toHaveCount(0);
});

test('keeps the Search criteria in the URL when an Entry is edited or deleted from Entry search, and drops an Entry edited out of the criteria from the results', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const edited = `Coffee ${run}`;
  const renamed = `Tea ${run}`;
  const deleted = `Coffee too ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, edited), twoLine(DAY, deleted)]);

  await searchFor(page, 'coffee');
  await expect(resultFor(page, edited)).toHaveCount(1);
  await expect(resultFor(page, deleted)).toHaveCount(1);
  const criteria = page.url();

  const dialog = await openEdit(resultFor(page, edited));
  await dialog.getByLabel('Memo').fill(renamed);
  await save(dialog);

  await expect(page).toHaveURL(criteria);
  await expect(entrySearchForm(page).getByLabel('Memo', { exact: true })).toHaveValue('coffee');
  await expect(resultFor(page, deleted)).toHaveCount(1);
  await expect(resultFor(page, renamed)).toHaveCount(0);
  await expect(resultFor(page, edited)).toHaveCount(0);

  await deleteListed(resultFor(page, deleted));

  await expect(page).toHaveURL(criteria);
  await expect(entrySearchForm(page).getByLabel('Memo', { exact: true })).toHaveValue('coffee');
  await expect(results(page)).toContainText(/match/i);
  await expect(resultFor(page, deleted)).toHaveCount(0);

  await page.goto('/entries');
  await expect(listedEntry(page, renamed)).toHaveCount(1);
});

test('asks Discard changes when Edit entry is closed with changes, by Close or Escape, and closes at once with none', async ({ page }) => {
  const run = randomUUID();
  const memo = `Original ${run}`;
  const draft = `Draft ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, memo));
  await dialog.getByLabel('Memo').fill(draft);

  await button(dialog, 'Close').click();
  const discard = discardDialog(page);
  await expect(discard).toBeVisible();
  await button(discard, 'Keep editing').click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Memo')).toHaveValue(draft);

  await dialog.getByLabel('Memo').press('Escape');
  await expect(discard).toBeVisible();
  await button(discard, 'Discard').click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeHidden();
  await expectAsPosted(listedEntry(page, memo));
  await expect(listedEntry(page, draft)).toHaveCount(0);

  const unchanged = await openEdit(listedEntry(page, memo));
  await button(unchanged, 'Close').click();
  await expect(unchanged).toBeHidden();
  await expect(entries(page)).toBeVisible();
  await expect(discard).toHaveCount(0);

  await page.reload();
  await expectAsPosted(listedEntry(page, memo));
});

test('edits and deletes an Entry at 390px', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Before ${run}`;
  const after = `After ${run}`;
  const kept = `Kept ${run}`;
  await signIn(page);
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, before)]);

  await page.setViewportSize(PHONE);
  await page.goto('/entries');
  const dialog = await openEdit(listedEntry(page, before));
  await expect(dialog.getByLabel('Memo')).toHaveValue(before);
  await dialog.getByLabel('Memo').fill(after);
  await dialog.getByLabel('Amount').fill('8000');
  await save(dialog);

  const edited = listedEntry(page, after);
  await expect(edited).toHaveCount(1);
  await expect(edited.getByTestId('entry-total')).toContainText(amountShown('8,000'));
  await expect(listedEntry(page, before)).toHaveCount(0);

  await deleteListed(edited);
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(edited).toHaveCount(0);

  await page.reload();
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(listedEntry(page, after)).toHaveCount(0);
});
