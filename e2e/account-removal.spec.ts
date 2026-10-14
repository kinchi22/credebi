import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  accountsSection,
  accountType,
  addAccount,
  addGroup,
  confirmDelete,
  dayInBrowser,
  expectOrder,
  expectRefused,
  openDelete,
  showEndedAccounts,
  type AccountFields,
  type AccountType,
  type Kind,
} from './accounts';
import {
  accountChoice,
  accountChoices,
  accountTick,
  AMOUNT,
  deleteListed,
  entrySearchForm,
  expectSuggested,
  listedEntry,
  nameOf,
  openEditEntry,
  openEntryForm,
  postEntries,
  saveEdit,
  SIDES,
  titleField,
  type AddedAccount,
  type TwoLineEntry,
} from './entries';
import { results, search } from './entry-search';
import { ENTRY_SEARCH_PATH, ENTRY_SEARCH_WITH_QUERY } from './routes';
import { signIn } from './session';
import { expectWithinPhone, PHONE } from './viewport';

const PETTY_CASH: AddedAccount = { added: 'Petty cash' };

type Posting = Omit<TwoLineEntry, 'day' | 'amount'>;

async function postToday(page: Page, postings: readonly Posting[]): Promise<void> {
  const day = await dayInBrowser(page);
  await postEntries(page, postings.map((posting) => ({ ...posting, day, amount: AMOUNT })));
}

async function deleteEntry(page: Page, memo: string): Promise<void> {
  await page.goto('/entries');
  await deleteListed(listedEntry(page, memo));
  await expect(listedEntry(page, memo)).toHaveCount(0);
}

async function remove(page: Page, type: AccountType, name: string, kind: Kind = 'account'): Promise<void> {
  const dialog = await openDelete(page, type, name, kind);
  await confirmDelete(dialog);
  await expect(dialog).toBeHidden();
}

async function signInWithPettyCash(page: Page, fields: Omit<AccountFields, 'name'> = {}): Promise<void> {
  await signIn(page);
  await page.goto('/settings');
  await addAccount(page, 'Assets', { ...fields, name: nameOf(PETTY_CASH) });
}

async function postNamingPettyCashAndDelete(page: Page): Promise<void> {
  const memo = `Mistaken ${randomUUID()}`;
  await postToday(page, [{ memo, debitAccount: 'Expenses', creditAccount: PETTY_CASH }]);
  await deleteEntry(page, memo);
  await page.goto('/settings');
}

async function addPostAndDelete(page: Page): Promise<void> {
  await signInWithPettyCash(page);
  await postNamingPettyCashAndDelete(page);
}

async function expectNotInChart(page: Page): Promise<void> {
  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash']);
  await showEndedAccounts(page).check();
  await expectOrder(assets, ['Cash']);
}

test('removes an Account no Entry names and one named only by a deleted Entry, and refuses one a shown Entry names, saying so and offering an end day instead', async ({ page }) => {
  const run = randomUUID();
  const kept = `Kept ${run}`;
  const deleted = `Deleted ${run}`;
  await signIn(page);
  await postToday(page, [
    { memo: kept, debitAccount: 'Expenses', creditAccount: 'Cash' },
    { memo: deleted, debitAccount: 'Cash', creditAccount: 'Sales' },
  ]);
  await deleteEntry(page, deleted);

  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: nameOf(PETTY_CASH) });

  const cancelled = await openDelete(page, 'Assets', nameOf(PETTY_CASH));
  await cancelled.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cancelled).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash', nameOf(PETTY_CASH)]);

  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  await remove(page, 'Revenue', 'Sales');
  await expectOrder(accountType(page, 'Revenue'), []);

  const named = await openDelete(page, 'Assets', 'Cash');
  await confirmDelete(named);
  await expectRefused(named);
  await expect(named.getByRole('alert')).toContainText(/shown entry/i);
  await expect(named.getByRole('alert')).toContainText(/end day/i);
  await named.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(named).toBeHidden();

  await page.reload();
  await expect(accountsSection(page)).toBeVisible();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
  await expectOrder(accountType(page, 'Revenue'), []);

  await page.goto('/entries');
  await expect(listedEntry(page, kept).getByTestId('entry-line').nth(1)).toContainText('Cash');
});

test('removes an Account whose only Entry was deleted from the Accounts section, Show ended accounts checked too, from the entry form\'s Account pickers in either Entry form mode, and from the Account filter of Entry search', async ({ page }) => {
  await addPostAndDelete(page);

  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await expectNotInChart(page);
  await page.reload();
  await expectNotInChart(page);

  const twoLine = await openEntryForm(page, 'Two-line mode');
  for (const side of SIDES) {
    await expect(accountChoice(twoLine, side, 'Cash')).toHaveCount(1);
    await expect(accountChoice(twoLine, side, nameOf(PETTY_CASH))).toHaveCount(0);
  }

  const multiLine = await openEntryForm(page, 'Multi-line mode');
  for (const side of SIDES) {
    await expect(accountTick(multiLine, side, 'Cash')).toHaveCount(1);
    await expect(accountTick(multiLine, side, PETTY_CASH)).toHaveCount(0);
  }

  await page.goto(ENTRY_SEARCH_PATH);
  const filter = entrySearchForm(page).getByLabel('Account', { exact: true });
  await expect(filter.getByRole('option', { name: 'Cash', exact: true })).toHaveCount(1);
  await expect(filter.getByRole('option', { name: nameOf(PETTY_CASH), exact: true })).toHaveCount(0);
});

test('removes an Account named only by a deleted Entry from the Suggested accounts of that Entry\'s Title', async ({ page }) => {
  const run = randomUUID();
  const deleted = `Deleted float ${run}`;
  const kept = `Kept float ${run}`;
  await signInWithPettyCash(page);
  await postToday(page, [
    { title: 'Float', memo: deleted, debitAccount: 'Expenses', creditAccount: PETTY_CASH },
    { title: 'Float', memo: kept, debitAccount: 'Expenses', creditAccount: 'Cash' },
  ]);
  await deleteEntry(page, deleted);

  await page.goto('/settings');
  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  const form = await openEntryForm(page, 'Two-line mode');
  await titleField(form).fill('Float');
  await expectSuggested(accountChoices(form, 'Credit'), 'radio', ['Cash']);
  await expectSuggested(accountChoices(form, 'Debit'), 'radio', ['Expenses']);
});

test('refuses an Entry search whose URL names a removed Account, as one naming an Account the chart does not hold', async ({ page }) => {
  await signInWithPettyCash(page);
  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, { account: nameOf(PETTY_CASH) });
  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
  await expect(results(page)).toBeVisible();
  const naming = page.url();

  await postNamingPettyCashAndDelete(page);
  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  await page.goto(naming);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/account/i);
  await expect(results(page)).toHaveCount(0);
});

test('removes an Account after a Correction moves the only Entry naming it to another Account, and keeps the corrected Entry on that Account', async ({ page }) => {
  const memo = `Corrected ${randomUUID()}`;
  await signInWithPettyCash(page);
  await postToday(page, [{ memo, debitAccount: 'Expenses', creditAccount: PETTY_CASH }]);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await accountChoice(dialog, 'Credit', 'Cash').check();
  await saveEdit(dialog);
  await expect(listedEntry(page, memo).getByTestId('entry-line').nth(1)).toContainText('Cash');

  await page.goto('/settings');
  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  await page.goto('/entries');
  const lines = listedEntry(page, memo).getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(1)).toContainText('Cash');
  await expect(lines.nth(1)).not.toContainText(nameOf(PETTY_CASH));
});

test('takes a removed Account out of its Account group, so the group can then be removed', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  await addGroup(page, 'Assets', { name: 'Bank' });
  await addAccount(page, 'Assets', { name: nameOf(PETTY_CASH), group: 'Bank' });
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank', nameOf(PETTY_CASH)]);
  await postNamingPettyCashAndDelete(page);

  await remove(page, 'Assets', nameOf(PETTY_CASH));
  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);

  await remove(page, 'Assets', 'Bank', 'group');

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
});

test('gives a new Account the name of a removed Account, ignoring case', async ({ page }) => {
  const reused = nameOf(PETTY_CASH).toUpperCase();
  await addPostAndDelete(page);
  await remove(page, 'Assets', nameOf(PETTY_CASH));

  await addAccount(page, 'Assets', { name: reused });
  await expectOrder(accountType(page, 'Assets'), ['Cash', reused]);

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', reused]);

  const form = await openEntryForm(page, 'Two-line mode');
  await expect(accountChoice(form, 'Credit', reused)).toHaveCount(1);
});

test('removes an Account whose only Entry was deleted at 390px', async ({ page }) => {
  await addPostAndDelete(page);
  await page.setViewportSize(PHONE);
  await page.reload();

  const dialog = await openDelete(page, 'Assets', nameOf(PETTY_CASH));
  await expectWithinPhone(page, dialog);
  await confirmDelete(dialog);
  await expect(dialog).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
  await expectWithinPhone(page, accountsSection(page));
});
