import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountsSection,
  accountType,
  ACCOUNT_TYPES,
  activeFrom,
  activeUntil,
  addAccount,
  addGroup,
  confirmDelete,
  dayInBrowser,
  drag,
  editAccount,
  expectInGroup,
  expectOrder,
  expectRefused,
  grip,
  grips,
  offeredType,
  openAdd,
  openDelete,
  openEdit,
  row,
  save,
  showEndedAccounts,
  pressSave,
} from './accounts';
import {
  accountChoice,
  ACCOUNTS,
  AMOUNT,
  type Account,
  entryForm, entrySearchForm, listedEntry, postEntries } from './entries';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';
import { PHONE } from './viewport';

async function openSettings(page: Page): Promise<void> {
  await signIn(page);
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();
}

async function expectAfterReload(page: Page, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 15_000 });
}

async function postToday(
  page: Page,
  memo: string,
  debitAccount: Account,
  creditAccount: Account,
): Promise<void> {
  const day = await dayInBrowser(page);
  await postEntries(page, [{ day, memo, debitAccount, creditAccount, amount: AMOUNT }]);
}

async function deleteEntry(page: Page, memo: string): Promise<void> {
  await page.goto('/entries');
  const entry = listedEntry(page, memo);
  await entry.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete entry', exact: true });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toHaveCount(0);
}

async function expectWithinPhone(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.x ?? Number.NaN).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? Number.NaN) + (box?.width ?? Number.NaN)).toBeLessThanOrEqual(PHONE.width);
  const scrollWidth = Number(await page.evaluate('document.documentElement.scrollWidth'));
  expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);
}

test('gives a new User Cash, Accounts payable, Capital, Sales and Expenses, one under each Account type, in the Accounts section of Settings', async ({ page }) => {
  await openSettings(page);

  for (const [index, type] of ACCOUNT_TYPES.entries()) {
    await expectOrder(accountType(page, type), [ACCOUNTS[index] ?? '']);
  }
});

test('adds an Account and an Account group at the end of their Account type, and keeps them after a reload', async ({ page }) => {
  await openSettings(page);

  await addAccount(page, 'Assets', { name: 'Wallet', description: 'Cash I carry' });
  await addGroup(page, 'Assets', { name: 'Bank', description: 'Accounts at a bank' });
  await addAccount(page, 'Assets', { name: 'ABC Bank', group: 'Bank' });

  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash', 'Wallet', 'Bank', 'ABC Bank']);

  await page.reload();
  await expectOrder(assets, ['Cash', 'Wallet', 'Bank', 'ABC Bank']);
  await expectInGroup(page, 'Assets', 'ABC Bank', 'Bank');

  const wallet = await openEdit(page, 'Assets', 'Wallet');
  await expect(wallet.getByLabel('Description', { exact: true })).toHaveValue('Cash I carry');
  await expect(activeFrom(wallet)).toHaveValue(await dayInBrowser(page));
});

test('shows the start day of an Account that starts in the future, and the entry form does not offer it for today', async ({ page }) => {
  await openSettings(page);
  const start = await dayInBrowser(page, 30);

  await addAccount(page, 'Assets', { name: 'Savings', activeFrom: start });

  await expect(row(accountType(page, 'Assets'), 'Savings')).toContainText(start);
  await page.reload();
  await expect(row(accountType(page, 'Assets'), 'Savings')).toContainText(start);

  await page.goto('/entries');
  const form = entryForm(page);
  await expect(form.getByLabel('Date')).toHaveValue(await dayInBrowser(page));
  await expect(accountChoice(form, 'Debit', 'Cash')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Savings')).toHaveCount(0);
  await expect(accountChoice(form, 'Credit', 'Savings')).toHaveCount(0);
});

test('shows the new name of a renamed Account on an Entry that names it', async ({ page }) => {
  const memo = `Stationery ${randomUUID()}`;
  await signIn(page);
  await postToday(page, memo, 'Expenses', 'Cash');

  await page.goto('/settings');
  await editAccount(page, 'Assets', 'Cash', { name: 'Wallet' });
  await expectOrder(accountType(page, 'Assets'), ['Wallet']);

  await page.goto('/entries');
  const lines = listedEntry(page, memo).getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Expenses');
  await expect(lines.nth(1)).toContainText('Wallet');
  await expect(lines.nth(1)).not.toContainText('Cash');
});

test('deletes an Account no Entry names, and refuses to delete one an Entry names, also after that Entry was deleted', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const kept = `Kept ${run}`;
  const deleted = `Deleted ${run}`;
  await signIn(page);
  await postToday(page, kept, 'Expenses', 'Cash');
  await postToday(page, deleted, 'Cash', 'Sales');
  await deleteEntry(page, deleted);

  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: 'Petty cash' });

  const cancelled = await openDelete(page, 'Assets', 'Petty cash');
  await cancelled.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cancelled).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Petty cash']);

  const unnamed = await openDelete(page, 'Assets', 'Petty cash');
  await confirmDelete(unnamed);
  await expect(unnamed).toBeHidden();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);

  const named = await openDelete(page, 'Assets', 'Cash');
  await confirmDelete(named);
  await expectRefused(named);
  await expect(named.getByRole('alert')).toContainText(/end day/i);

  await named.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(named).toBeHidden();

  const namedOnlyByDeleted = await openDelete(page, 'Revenue', 'Sales');
  await confirmDelete(namedOnlyByDeleted);
  await expectRefused(namedOnlyByDeleted);
  await expect(namedOnlyByDeleted.getByRole('alert')).toContainText(/end day/i);

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
  await expectOrder(accountType(page, 'Revenue'), ['Sales']);

  await page.goto('/entries');
  await expect(listedEntry(page, kept).getByTestId('entry-line').nth(1)).toContainText('Cash');
});

test('deletes an empty Account group, and refuses to delete one that holds an Account', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Liabilities', { name: 'Loans' });
  await addGroup(page, 'Liabilities', { name: 'Cards' });
  await addAccount(page, 'Liabilities', { name: 'Visa', group: 'Cards' });
  const liabilities = accountType(page, 'Liabilities');
  await expectOrder(liabilities, ['Accounts payable', 'Loans', 'Cards', 'Visa']);

  const empty = await openDelete(page, 'Liabilities', 'Loans', 'group');
  await confirmDelete(empty);
  await expect(empty).toBeHidden();
  await expectOrder(liabilities, ['Accounts payable', 'Cards', 'Visa']);

  const holding = await openDelete(page, 'Liabilities', 'Cards', 'group');
  await confirmDelete(holding);
  await expectRefused(holding);

  await page.reload();
  await expectOrder(liabilities, ['Accounts payable', 'Cards', 'Visa']);

  const visa = await openDelete(page, 'Liabilities', 'Visa');
  await confirmDelete(visa);
  await expect(visa).toBeHidden();
  const emptied = await openDelete(page, 'Liabilities', 'Cards', 'group');
  await confirmDelete(emptied);
  await expect(emptied).toBeHidden();

  await page.reload();
  await expectOrder(liabilities, ['Accounts payable']);
});

test('refuses a duplicate Account name, and a duplicate Account group name within one Account type, ignoring case', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Assets', { name: 'Bank' });

  const account = await openAdd(page, 'Expenses', 'account');
  await account.getByLabel('Name', { exact: true }).fill('CASH');
  await pressSave(account);
  await expectRefused(account);
  await expect(account.getByLabel('Name', { exact: true })).toHaveValue('CASH');
  await account.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(account).toBeHidden();

  const group = await openAdd(page, 'Assets', 'group');
  await group.getByLabel('Name', { exact: true }).fill('bank');
  await pressSave(group);
  await expectRefused(group);
  await group.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(group).toBeHidden();

  await addGroup(page, 'Liabilities', { name: 'bank' });

  const renamed = await openEdit(page, 'Revenue', 'Sales');
  await renamed.getByLabel('Name', { exact: true }).fill('expenses');
  await pressSave(renamed);
  await expectRefused(renamed);

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);
  await expectOrder(accountType(page, 'Liabilities'), ['Accounts payable', 'bank']);
  await expectOrder(accountType(page, 'Revenue'), ['Sales']);
  await expectOrder(accountType(page, 'Expenses'), ['Expenses']);
});

test('reorders by dragging a grip, moves an Account into and out of an Account group, and keeps each change after a reload', async ({ page }) => {
  test.slow();
  await openSettings(page);
  await addAccount(page, 'Assets', { name: 'Wallet' });
  await addGroup(page, 'Assets', { name: 'Bank' });
  await addAccount(page, 'Assets', { name: 'ABC Bank', group: 'Bank' });
  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash', 'Wallet', 'Bank', 'ABC Bank']);

  await drag(page, grip(assets, 'Wallet'), grip(assets, 'Cash'));
  await expectAfterReload(page, () => expectOrder(assets, ['Wallet', 'Cash', 'Bank', 'ABC Bank']));

  await drag(page, grip(assets, 'Cash'), grip(assets, 'ABC Bank'));
  await expectAfterReload(page, async () => {
    await expect(grips(assets)).toHaveCount(4);
    await expect(grips(assets).nth(0)).toHaveAccessibleName('Move Wallet');
    await expect(grips(assets).nth(1)).toHaveAccessibleName('Move Bank');
  });
  await expectInGroup(page, 'Assets', 'Cash', 'Bank');

  await drag(page, grip(assets, 'ABC Bank'), grip(assets, 'Wallet'));
  await expectAfterReload(page, () => expectOrder(assets, ['ABC Bank', 'Wallet', 'Bank', 'Cash']));
});

test('moves an Account into an Account group, last in it, through the Group field of Edit account', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Expenses', { name: 'Travel' });
  await addAccount(page, 'Expenses', { name: 'Hotels', group: 'Travel' });
  await addAccount(page, 'Expenses', { name: 'Meals' });
  const expenses = accountType(page, 'Expenses');
  await expectOrder(expenses, ['Expenses', 'Travel', 'Hotels', 'Meals']);

  await editAccount(page, 'Expenses', 'Expenses', { group: 'Travel' });
  await expectOrder(expenses, ['Travel', 'Hotels', 'Expenses', 'Meals']);

  await page.reload();
  await expectOrder(expenses, ['Travel', 'Hotels', 'Expenses', 'Meals']);
  await expectInGroup(page, 'Expenses', 'Expenses', 'Travel');
});

test('hides an ended Account until Show ended accounts is checked, and never hides one that has not started', async ({ page }) => {
  await openSettings(page);
  await addAccount(page, 'Assets', {
    name: 'Old wallet',
    activeFrom: await dayInBrowser(page, -30),
    activeUntil: await dayInBrowser(page, -1),
  });
  await addAccount(page, 'Assets', { name: 'Savings', activeFrom: await dayInBrowser(page, 30) });
  await addAccount(page, 'Assets', { name: 'Purse', activeUntil: await dayInBrowser(page) });
  const assets = accountType(page, 'Assets');

  await expect(showEndedAccounts(page)).not.toBeChecked();
  await expectOrder(assets, ['Cash', 'Savings', 'Purse']);

  await showEndedAccounts(page).check();
  await expectOrder(assets, ['Cash', 'Old wallet', 'Savings', 'Purse']);

  await showEndedAccounts(page).uncheck();
  await expectOrder(assets, ['Cash', 'Savings', 'Purse']);

  await page.reload();
  await expectOrder(assets, ['Cash', 'Savings', 'Purse']);
});

test('offers in the entry form only the Accounts active on the Entry\'s day, following a change of day', async ({ page }) => {
  await openSettings(page);
  const past = await dayInBrowser(page, -20);
  const future = await dayInBrowser(page, 40);
  await addAccount(page, 'Assets', {
    name: 'Old wallet',
    activeFrom: await dayInBrowser(page, -30),
    activeUntil: await dayInBrowser(page, -10),
  });
  await addAccount(page, 'Assets', { name: 'Savings', activeFrom: await dayInBrowser(page, 30) });

  await page.goto('/entries');
  const form = entryForm(page);
  await expect(accountChoice(form, 'Debit', 'Cash')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Old wallet')).toHaveCount(0);
  await expect(accountChoice(form, 'Debit', 'Savings')).toHaveCount(0);

  await form.getByLabel('Date').fill(past);
  await expect(accountChoice(form, 'Debit', 'Old wallet')).toHaveCount(1);
  await expect(accountChoice(form, 'Credit', 'Old wallet')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Cash')).toHaveCount(0);
  await expect(accountChoice(form, 'Debit', 'Savings')).toHaveCount(0);

  await form.getByLabel('Date').fill(future);
  await expect(accountChoice(form, 'Debit', 'Savings')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Cash')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Old wallet')).toHaveCount(0);
});

test('offers in the entry form each Account group as a heading over its Accounts, in the User\'s order', async ({ page }) => {
  await openSettings(page);
  await addAccount(page, 'Expenses', { name: 'Rent' });
  await addGroup(page, 'Expenses', { name: 'Travel' });
  await addAccount(page, 'Expenses', { name: 'Meals' });
  await addAccount(page, 'Expenses', { name: 'Hotels', group: 'Travel' });
  await addAccount(page, 'Expenses', { name: 'Flights', group: 'Travel' });

  await page.goto('/entries');
  const expenses = offeredType(entryForm(page), 'Debit', 'Expenses');
  const radios = expenses.getByRole('radio');
  const order = ['Expenses', 'Rent', 'Hotels', 'Flights', 'Meals'];
  await expect(radios).toHaveCount(order.length);
  for (const [index, name] of order.entries()) {
    await expect(radios.nth(index)).toHaveAccessibleName(name);
  }
  await expect(expenses.getByRole('radio', { name: 'Travel', exact: true })).toHaveCount(0);
  await expect(expenses.getByText('Travel', { exact: true })).toBeVisible();
  await expect(expenses).toHaveText(/Rent[\s\S]*Travel[\s\S]*Hotels[\s\S]*Flights[\s\S]*Meals/);
});

test('refuses an Active period change that would leave a shown Entry outside it', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page);
  await postToday(page, memo, 'Expenses', 'Cash');
  const today = await dayInBrowser(page);
  const tomorrow = await dayInBrowser(page, 1);

  await page.goto('/settings');
  const dialog = await openEdit(page, 'Assets', 'Cash');
  const start = await activeFrom(dialog).inputValue();
  await activeFrom(dialog).fill(tomorrow);
  await pressSave(dialog);
  await expectRefused(dialog);

  await page.reload();
  const reopened = await openEdit(page, 'Assets', 'Cash');
  await expect(activeFrom(reopened)).toHaveValue(start);
  await expect(activeUntil(reopened)).toHaveValue('');
  await activeUntil(reopened).fill(today);
  await save(reopened);

  await page.reload();
  const kept = await openEdit(page, 'Assets', 'Cash');
  await expect(activeFrom(kept)).toHaveValue(start);
  await expect(activeUntil(kept)).toHaveValue(today);
});

test('lists an ended Account, last, in the Account filter of Entry search', async ({ page }) => {
  await openSettings(page);
  await addAccount(page, 'Assets', {
    name: 'Old wallet',
    activeFrom: await dayInBrowser(page, -30),
    activeUntil: await dayInBrowser(page, -1),
  });

  await page.goto(ENTRY_SEARCH_PATH);
  const filter = entrySearchForm(page).getByLabel('Account', { exact: true });
  await expect(filter.getByRole('option', { name: 'Old wallet', exact: true })).toHaveCount(1);
  await expect(filter.getByRole('option', { name: 'Cash', exact: true })).toHaveCount(1);
  await expect(filter.getByRole('option').last()).toHaveText('Old wallet');
});

test('adds, edits and deletes an Account and an Account group in the Accounts section at 390px', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();

  const added = await openAdd(page, 'Assets', 'account');
  await expectWithinPhone(page, added);
  await added.getByLabel('Name', { exact: true }).fill('Wallet');
  await save(added);
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Wallet']);
  await expectWithinPhone(page, accountsSection(page));

  const edited = await openEdit(page, 'Assets', 'Wallet');
  await expectWithinPhone(page, edited);
  await edited.getByLabel('Name', { exact: true }).fill('Purse');
  await save(edited);
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Purse']);

  const deleted = await openDelete(page, 'Assets', 'Purse');
  await expectWithinPhone(page, deleted);
  await confirmDelete(deleted);
  await expect(deleted).toBeHidden();

  const addedGroup = await openAdd(page, 'Assets', 'group');
  await expectWithinPhone(page, addedGroup);
  await addedGroup.getByLabel('Name', { exact: true }).fill('Bank');
  await save(addedGroup);
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);

  const editedGroup = await openEdit(page, 'Assets', 'Bank', 'group');
  await expectWithinPhone(page, editedGroup);
  await editedGroup.getByLabel('Name', { exact: true }).fill('Banks');
  await save(editedGroup);
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Banks']);

  const deletedGroup = await openDelete(page, 'Assets', 'Banks', 'group');
  await expectWithinPhone(page, deletedGroup);
  await confirmDelete(deletedGroup);
  await expect(deletedGroup).toBeHidden();

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
});
