import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
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
} from './accounts';
import {
  accountChoice,
  accountTick,
  AMOUNT,
  deleteListed,
  entryForm,
  entrySearchForm,
  fillHeading,
  listedEntry,
  openEditEntry,
  openEntryForm,
  saveEdit,
  submit,
} from './entries';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';
import { setEntryFormMode } from './settings';

const PETTY_CASH = 'Petty cash';

async function postNaming(
  page: Page,
  memo: string,
  creditAccount: string,
  debitAccount = 'Expenses',
): Promise<void> {
  await setEntryFormMode(page, 'Two-line mode');
  await page.goto('/entries');
  const form = entryForm(page);
  await fillHeading(form, { day: await dayInBrowser(page), memo });
  await accountChoice(form, 'Debit', debitAccount).check();
  await accountChoice(form, 'Credit', creditAccount).check();
  await form.getByLabel('Amount').fill(AMOUNT);
  await submit(form);
  await expect(listedEntry(page, memo)).toHaveCount(1);
}

async function deleteEntry(page: Page, memo: string): Promise<void> {
  await page.goto('/entries');
  await deleteListed(listedEntry(page, memo));
  await expect(listedEntry(page, memo)).toHaveCount(0);
}

async function removeAccount(page: Page, name: string): Promise<void> {
  await page.goto('/settings');
  const dialog = await openDelete(page, 'Assets', name);
  await confirmDelete(dialog);
  await expect(dialog).toBeHidden();
}

async function addPostAndDelete(page: Page): Promise<void> {
  const memo = `Mistaken ${randomUUID()}`;
  await signIn(page);
  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: PETTY_CASH });
  await postNaming(page, memo, PETTY_CASH);
  await deleteEntry(page, memo);
}

async function expectNotInChart(page: Page): Promise<void> {
  await page.goto('/settings');
  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash']);
  await showEndedAccounts(page).check();
  await expectOrder(assets, ['Cash']);
}

async function expectNotOffered(form: Locator, choice: (side: 'Debit' | 'Credit', name: string) => Locator): Promise<void> {
  await expect(form).toBeVisible();
  for (const side of ['Debit', 'Credit'] as const) {
    await expect(choice(side, 'Cash')).toHaveCount(1);
    await expect(choice(side, PETTY_CASH)).toHaveCount(0);
  }
}

test('deletes an Account no Entry names, and an Account named only by an Entry that was deleted, and refuses to delete one a shown Entry names, saying so and offering an end day instead', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const kept = `Kept ${run}`;
  const deleted = `Deleted ${run}`;
  await signIn(page);
  await postNaming(page, kept, 'Cash');
  await postNaming(page, deleted, 'Sales', 'Cash');
  await deleteEntry(page, deleted);

  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: PETTY_CASH });

  const cancelled = await openDelete(page, 'Assets', PETTY_CASH);
  await cancelled.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cancelled).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash', PETTY_CASH]);

  const unnamed = await openDelete(page, 'Assets', PETTY_CASH);
  await confirmDelete(unnamed);
  await expect(unnamed).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  const namedOnlyByDeleted = await openDelete(page, 'Revenue', 'Sales');
  await confirmDelete(namedOnlyByDeleted);
  await expect(namedOnlyByDeleted).toBeHidden();
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
  test.slow();
  await addPostAndDelete(page);

  await removeAccount(page, PETTY_CASH);
  await expectNotInChart(page);
  await page.reload();
  await expectNotInChart(page);

  const twoLine = await openEntryForm(page, 'Two-line mode');
  await expectNotOffered(twoLine, (side, name) => accountChoice(twoLine, side, name));

  const multiLine = await openEntryForm(page, 'Multi-line mode');
  await expectNotOffered(multiLine, (side, name) => accountTick(multiLine, side, { added: name }));

  await page.goto(ENTRY_SEARCH_PATH);
  const filter = entrySearchForm(page).getByLabel('Account', { exact: true });
  await expect(filter.getByRole('option', { name: 'Cash', exact: true })).toHaveCount(1);
  await expect(filter.getByRole('option', { name: PETTY_CASH, exact: true })).toHaveCount(0);
});

test('removes an Account after a Correction moves the only Entry naming it to another Account, and keeps the corrected Entry on that Account', async ({ page }) => {
  const memo = `Corrected ${randomUUID()}`;
  await signIn(page);
  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: PETTY_CASH });
  await postNaming(page, memo, PETTY_CASH);

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, memo));
  await accountChoice(dialog, 'Credit', 'Cash').check();
  await saveEdit(dialog);
  await expect(listedEntry(page, memo).getByTestId('entry-line').nth(1)).toContainText('Cash');

  await removeAccount(page, PETTY_CASH);
  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  await page.goto('/entries');
  const lines = listedEntry(page, memo).getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(1)).toContainText('Cash');
  await expect(lines.nth(1)).not.toContainText(PETTY_CASH);
});

test('takes a removed Account out of its Account group, so the group can then be deleted', async ({ page }) => {
  test.slow();
  const memo = `Grouped ${randomUUID()}`;
  await signIn(page);
  await page.goto('/settings');
  await addGroup(page, 'Assets', { name: 'Bank' });
  await addAccount(page, 'Assets', { name: PETTY_CASH, group: 'Bank' });
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank', PETTY_CASH]);
  await postNaming(page, memo, PETTY_CASH);
  await deleteEntry(page, memo);

  await removeAccount(page, PETTY_CASH);
  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);

  const group = await openDelete(page, 'Assets', 'Bank', 'group');
  await confirmDelete(group);
  await expect(group).toBeHidden();

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
});

test('gives a new Account the name of a removed Account, ignoring case', async ({ page }) => {
  test.slow();
  const reused = PETTY_CASH.toUpperCase();
  await addPostAndDelete(page);
  await removeAccount(page, PETTY_CASH);

  await addAccount(page, 'Assets', { name: reused });
  await expectOrder(accountType(page, 'Assets'), ['Cash', reused]);

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', reused]);

  const form = await openEntryForm(page, 'Two-line mode');
  await expect(accountChoice(form, 'Credit', reused)).toHaveCount(1);
});
