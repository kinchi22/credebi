import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  accountTicks,
  amountShown,
  editButton,
  AMOUNT,
  DAY,
  entries,
  entryForm,
  entrySearchForm,
  lineAmount,
  lineGroups,
  listedEntry,
  openEditEntry,
  postEntries,
  submit,
  submitMultiLineEntry,
  TWELVE_THOUSAND_FIVE_HUNDRED,
  type MultiLineEntry,
  type TwoLineEntry,
} from './entries';
import { resultFor, results, search } from './entry-search';
import { ENTRY_SEARCH_PATH as SEARCH, ENTRY_SEARCH_WITH_QUERY } from './routes';
import { BOOKS_OPEN } from './accounts';
import {
  clickScrim,
  closeDialog,
  closeDiscarding,
  discardChanges,
  discardDialog,
  keepEditing,
  selectByDraggingOntoScrim,
} from './dialog';
import { signIn } from './session';
import { setEntryFormMode } from './settings';
import { PHONE } from './viewport';

const EDITED_DAY = '2026-09-20';

const deleteButton = (entry: Locator): Locator =>
  entry.getByRole('button', { name: 'Delete', exact: true });

const deleteDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Delete entry', exact: true });

const button = (scope: Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

const twoLine = (day: string, memo: string): TwoLineEntry => ({
  day,
  memo,
  debitAccount: 'Expenses',
  creditAccount: 'Cash',
  amount: AMOUNT,
});

async function save(dialog: Locator): Promise<void> {
  await submit(dialog, 'Save');
  await expect(dialog).toBeHidden();
}

async function openDelete(entry: Locator): Promise<Locator> {
  await deleteButton(entry).click();
  const dialog = deleteDialog(entry.page());
  await expect(dialog).toBeVisible();
  return dialog;
}

async function deleteListed(entry: Locator): Promise<void> {
  const dialog = await openDelete(entry);
  await button(dialog, 'Delete').click();
  await expect(dialog).toBeHidden();
}

async function rewriteTwoLine(dialog: Locator, memo: string): Promise<void> {
  await dialog.getByLabel('Date').fill(EDITED_DAY);
  await dialog.getByLabel('Memo').fill(memo);
  await accountChoice(dialog, 'Credit', 'Accounts payable').check();
  await dialog.getByLabel('Amount').fill('8000');
}

type Shown = {
  readonly day: string;
  readonly creditAccount: string;
  readonly total: RegExp;
};

const AS_POSTED: Shown = { day: DAY, creditAccount: 'Cash', total: TWELVE_THOUSAND_FIVE_HUNDRED };

const REWRITTEN: Shown = { day: EDITED_DAY, creditAccount: 'Accounts payable', total: amountShown('8,000') };

async function expectShown(entry: Locator, shown: Shown): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(shown.day);
  const lines = entry.getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Expenses');
  await expect(lines.nth(1)).toContainText(shown.creditAccount);
  await expect(entry.getByTestId('entry-total')).toContainText(shown.total);
}

const expectRewritten = (entry: Locator): Promise<void> => expectShown(entry, REWRITTEN);

const expectAsPosted = (entry: Locator): Promise<void> => expectShown(entry, AS_POSTED);

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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, doomed)]);

  await page.goto('/entries');
  const entry = listedEntry(page, doomed);
  const dialog = await openDelete(entry);
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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));

  await expectTwoLineMode(dialog);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(accountChoice(dialog, 'Debit', 'Expenses')).toBeChecked();
  await expect(accountChoice(dialog, 'Credit', 'Cash')).toBeChecked();
  await expect(dialog.getByLabel('Amount')).toHaveValue(AMOUNT);
});

test('opens Edit entry in Multi-line mode, filled with every line, for a Two-line mode User and an Entry of more than two lines', async ({ page }) => {
  const memo = `Supplies on account ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
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
  const dialog = await openEditEntry(listedEntry(page, memo));

  await expectMultiLineMode(dialog, 3);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineAmount(dialog, 'Debit', 'Expenses')).toHaveValue('12500');
  await expect(lineAmount(dialog, 'Credit', 'Cash')).toHaveValue('12000');
  await expect(lineAmount(dialog, 'Credit', 'Accounts payable')).toHaveValue('500');
});

test('opens Edit entry in Multi-line mode, filled with the Entry, for a Multi-line mode User and an Entry of one debit and one credit line', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, memo)]);
  await setEntryFormMode(page, 'Multi-line mode');

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));

  await expectMultiLineMode(dialog, 2);
  await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineAmount(dialog, 'Debit', 'Expenses')).toHaveValue(AMOUNT);
  await expect(lineAmount(dialog, 'Credit', 'Cash')).toHaveValue(AMOUNT);
});

test('shows only the new version of an edited Entry in the Entry list, after a reload too, and Entry search finds only the new version', async ({ page }) => {
  const run = randomUUID();
  const before = `Before ${run}`;
  const after = `After ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, before)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, before));
  await rewriteTwoLine(dialog, after);
  await save(dialog);

  await expectRewritten(listedEntry(page, after));
  await expect(listedEntry(page, run)).toHaveCount(1);
  await expect(listedEntry(page, before)).toHaveCount(0);

  await page.reload();
  await expectRewritten(listedEntry(page, after));
  await expect(listedEntry(page, run)).toHaveCount(1);
  await expect(listedEntry(page, before)).toHaveCount(0);

  await searchFor(page, run);
  await expectRewritten(resultFor(page, after));
  await expect(resultFor(page, run)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
});

test('edits an edited Entry again, and deletes it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const second = `Second ${run}`;
  const third = `Third ${run}`;
  const kept = `Kept ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, first)]);

  await page.goto('/entries');
  const once = await openEditEntry(listedEntry(page, first));
  await once.getByLabel('Memo').fill(second);
  await save(once);
  await expect(listedEntry(page, second)).toHaveCount(1);

  const twice = await openEditEntry(listedEntry(page, second));
  await expect(twice.getByLabel('Memo')).toHaveValue(second);
  await rewriteTwoLine(twice, third);
  await save(twice);

  await expectRewritten(listedEntry(page, third));
  await expect(listedEntry(page, run)).toHaveCount(2);
  await expect(listedEntry(page, first)).toHaveCount(0);
  await expect(listedEntry(page, second)).toHaveCount(0);

  await deleteListed(listedEntry(page, third));
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(listedEntry(page, third)).toHaveCount(0);

  await page.reload();
  await expect(listedEntry(page, kept)).toHaveCount(1);
  await expect(listedEntry(page, run)).toHaveCount(1);
});

test('closes Edit entry on Save with no change, and lists the Entry once, unchanged', async ({ page }) => {
  const run = randomUUID();
  const memo = `Unchanged ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  await save(await openEditEntry(listedEntry(page, memo)));

  await expectAsPosted(listedEntry(page, memo));
  await expect(listedEntry(page, run)).toHaveCount(1);

  await page.reload();
  await expectAsPosted(listedEntry(page, memo));
  await expect(listedEntry(page, run)).toHaveCount(1);
});

test('keeps Edit entry open with the input and says the balance is wrong when an edit is Unbalanced', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ledger ${run}`;
  const edited = `Typo ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postMultiLine(page, {
    day: DAY,
    memo,
    lines: [
      { side: 'Debit', account: 'Expenses', amount: AMOUNT },
      { side: 'Credit', account: 'Cash', amount: AMOUNT },
    ],
  });

  const dialog = await openEditEntry(listedEntry(page, memo));
  await dialog.getByLabel('Memo').fill(edited);
  await lineAmount(dialog, 'Credit', 'Cash').fill('12000');
  await submit(dialog, 'Save');

  await expect(dialog.getByRole('alert')).toContainText(/balance/i);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Memo')).toHaveValue(edited);
  await expect(lineAmount(dialog, 'Credit', 'Cash')).toHaveValue('12000');

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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, edited), twoLine(DAY, deleted)]);

  await searchFor(page, 'coffee');
  await expect(resultFor(page, edited)).toHaveCount(1);
  await expect(resultFor(page, deleted)).toHaveCount(1);
  const criteria = page.url();

  const dialog = await openEditEntry(resultFor(page, edited));
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

test('asks Discard changes when Edit entry is closed with changes, by Close, by clicking outside it or by Escape, and closes at once with none', async ({ page }) => {
  const run = randomUUID();
  const memo = `Original ${run}`;
  const draft = `Draft ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await dialog.getByLabel('Memo').fill(draft);

  const memoField = dialog.getByLabel('Memo');
  await closeDialog(dialog);
  await keepEditing(dialog, memoField, draft);

  await clickScrim(page);
  await keepEditing(dialog, memoField, draft);

  await memoField.press('Escape');
  await discardChanges(dialog);
  await expectAsPosted(listedEntry(page, memo));
  await expect(listedEntry(page, draft)).toHaveCount(0);

  const unchanged = await openEditEntry(listedEntry(page, memo));
  await closeDialog(unchanged);
  await expect(unchanged).toBeHidden();
  await expect(entries(page)).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);

  await page.reload();
  await expectAsPosted(listedEntry(page, memo));
});

test('keeps Edit entry open with its input when a press inside it is released on the scrim', async ({ page }) => {
  const run = randomUUID();
  const memo = `Original ${run}`;
  const draft = `Draft ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, memo)]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));

  await selectByDraggingOntoScrim(dialog.getByLabel('Memo'));
  await expect(dialog).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(dialog.getByLabel('Memo')).toHaveValue(memo);

  await dialog.getByLabel('Memo').fill(draft);
  await selectByDraggingOntoScrim(dialog.getByLabel('Memo'));
  await expect(dialog).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(dialog.getByLabel('Memo')).toHaveValue(draft);

  await closeDiscarding(dialog);
  await expectAsPosted(listedEntry(page, memo));
});

test('edits and deletes an Entry at 390px', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Before ${run}`;
  const after = `After ${run}`;
  const kept = `Kept ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [twoLine(DAY, kept), twoLine(DAY, before)]);

  await page.setViewportSize(PHONE);
  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, before));
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
