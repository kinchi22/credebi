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
  dragTo,
  endOfList,
  editAccount,
  expectInGroup,
  expectOrder,
  expectRefused,
  grip,
  grips,
  headingRowMiddle,
  headingRowTopEdge,
  NO_GROUP,
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
  clickScrim,
  closeDialog,
  closeDiscarding,
  discardChanges,
  discardDialog,
  keepEditing,
  selectByDraggingOntoScrim,
} from './dialog';
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
  await closeDiscarding(account);

  const group = await openAdd(page, 'Assets', 'group');
  await group.getByLabel('Name', { exact: true }).fill('bank');
  await pressSave(group);
  await expectRefused(group);
  await closeDiscarding(group);

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

type AccountDialog = {
  readonly title: string;
  readonly open: (page: Page) => Promise<Locator>;
  readonly savedName: string;
};

const ACCOUNT_DIALOGS: readonly AccountDialog[] = [
  { title: 'Add account', open: (page) => openAdd(page, 'Assets', 'account'), savedName: '' },
  { title: 'Edit account', open: (page) => openEdit(page, 'Assets', 'Cash'), savedName: 'Cash' },
  { title: 'Add group', open: (page) => openAdd(page, 'Assets', 'group'), savedName: '' },
  { title: 'Edit group', open: (page) => openEdit(page, 'Assets', 'Bank', 'group'), savedName: 'Bank' },
];

const nameField = (dialog: Locator): Locator => dialog.getByLabel('Name', { exact: true });

test('closes Add account, Edit account, Add group and Edit group at once by Close, Escape or a click on the scrim when nothing was changed, and gives them no Cancel', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Assets', { name: 'Bank' });

  for (const { title, open } of ACCOUNT_DIALOGS) {
    const byClose = await open(page);
    await expect(byClose.getByRole('button', { name: 'Cancel', exact: true }), title).toHaveCount(0);
    await closeDialog(byClose);
    await expect(byClose).toBeHidden();

    const byEscape = await open(page);
    await page.keyboard.press('Escape');
    await expect(byEscape).toBeHidden();

    const byScrim = await open(page);
    await clickScrim(page);
    await expect(byScrim).toBeHidden();

    await expect(discardDialog(page)).toHaveCount(0);
  }
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);
});

test('asks Discard changes when Add account, Edit account, Add group or Edit group is closed with a change, keeps the input on Keep editing, and saves nothing on Discard', async ({ page }) => {
  test.slow();
  await openSettings(page);
  await addGroup(page, 'Assets', { name: 'Bank' });

  for (const { title, open } of ACCOUNT_DIALOGS) {
    const draft = `Draft ${title}`;
    const dialog = await open(page);
    await nameField(dialog).fill(draft);

    await closeDialog(dialog);
    await keepEditing(dialog, nameField(dialog), draft);

    await clickScrim(page);
    await keepEditing(dialog, nameField(dialog), draft);

    await nameField(dialog).press('Escape');
    await discardChanges(dialog);
  }

  await page.reload();
  await expectOrder(accountType(page, 'Assets'), ['Cash', 'Bank']);
  for (const { title, open, savedName } of ACCOUNT_DIALOGS) {
    const reopened = await open(page);
    await expect(nameField(reopened), title).toHaveValue(savedName);
    await closeDialog(reopened);
    await expect(reopened).toBeHidden();
  }
});

test('keeps Edit account open with its input when a press inside it is released on the scrim', async ({ page }) => {
  await openSettings(page);
  const dialog = await openEdit(page, 'Assets', 'Cash');

  await selectByDraggingOntoScrim(nameField(dialog));
  await expect(dialog).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(nameField(dialog)).toHaveValue('Cash');

  await nameField(dialog).fill('Wallet');
  await selectByDraggingOntoScrim(nameField(dialog));
  await expect(dialog).toBeVisible();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(nameField(dialog)).toHaveValue('Wallet');

  await closeDiscarding(dialog);
  await expectOrder(accountType(page, 'Assets'), ['Cash']);
});

async function addBankAndCards(page: Page, before: readonly string[] = []): Promise<Locator> {
  await openSettings(page);
  for (const name of before) {
    await addAccount(page, 'Assets', { name });
  }
  await addGroup(page, 'Assets', { name: 'Bank' });
  await addAccount(page, 'Assets', { name: 'ABC Bank', group: 'Bank' });
  await addGroup(page, 'Assets', { name: 'Cards' });
  await addAccount(page, 'Assets', { name: 'Visa', group: 'Cards' });
  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash', ...before, 'Bank', 'ABC Bank', 'Cards', 'Visa']);
  return assets;
}

test('puts an Account dropped on an Account group\'s heading row, below its top edge, last in that group, and keeps it after a reload', async ({ page }) => {
  test.slow();
  const assets = await addBankAndCards(page);

  await dragTo(page, grip(assets, 'Visa'), await headingRowMiddle(assets, 'Bank'));
  await expectAfterReload(page, () => expectOrder(assets, ['Cash', 'Bank', 'ABC Bank', 'Visa', 'Cards']));
  await expectInGroup(page, 'Assets', 'Visa', 'Bank');

  await dragTo(page, grip(assets, 'Cash'), await headingRowMiddle(assets, 'Cards'));
  await expectAfterReload(page, () => expectOrder(assets, ['Bank', 'ABC Bank', 'Visa', 'Cards', 'Cash']));
  await expectInGroup(page, 'Assets', 'Cash', 'Cards');
});

test('puts an Account dropped on the top edge of an Account group\'s heading row at the top level just before that group', async ({ page }) => {
  test.slow();
  const assets = await addBankAndCards(page, ['Wallet']);

  await dragTo(page, grip(assets, 'Cash'), await headingRowTopEdge(assets, 'Bank'));
  await expectAfterReload(page, () =>
    expectOrder(assets, ['Wallet', 'Cash', 'Bank', 'ABC Bank', 'Cards', 'Visa']),
  );
  await expectInGroup(page, 'Assets', 'Cash', NO_GROUP);

  await dragTo(page, grip(assets, 'Visa'), await headingRowTopEdge(assets, 'Bank'));
  await expectAfterReload(page, () =>
    expectOrder(assets, ['Wallet', 'Cash', 'Visa', 'Bank', 'ABC Bank', 'Cards']),
  );
  await expectInGroup(page, 'Assets', 'Visa', NO_GROUP);
});

test('puts an Account dropped on the drop zone at the end of its Account type\'s list last at the top level, also when the list ends in an Account group', async ({ page }) => {
  test.slow();
  const assets = await addBankAndCards(page);

  await dragTo(page, grip(assets, 'ABC Bank'), await endOfList(assets));
  await expectAfterReload(page, () => expectOrder(assets, ['Cash', 'Bank', 'Cards', 'Visa', 'ABC Bank']));
  await expectInGroup(page, 'Assets', 'ABC Bank', NO_GROUP);

  await dragTo(page, grip(assets, 'Cash'), await endOfList(assets));
  await expectAfterReload(page, () => expectOrder(assets, ['Bank', 'Cards', 'Visa', 'ABC Bank', 'Cash']));
  await expectInGroup(page, 'Assets', 'Cash', NO_GROUP);
});

async function holdServerActions(page: Page): Promise<{
  readonly held: () => number;
  readonly release: () => void;
}> {
  let release: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route(
    (url) => url.pathname === '/settings',
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST' || (await request.headerValue('next-action')) === null) {
        await route.fallback();
        return;
      }
      held += 1;
      await released;
      await route.continue();
    },
  );
  return { held: () => held, release: () => release?.() };
}

async function expectControls(section: Locator, enabled: boolean): Promise<void> {
  await expect(section.getByRole('button').first()).toBeVisible();
  await expect(section.getByRole('button', { disabled: enabled })).toHaveCount(0);
  const toggle = showEndedAccounts(section.page());
  await (enabled ? expect(toggle).toBeEnabled() : expect(toggle).toBeDisabled());
}

test('marks the Accounts section busy and disables its controls while a move is being saved, and enables them with the new order once it is saved', async ({ page }) => {
  await openSettings(page);
  await addAccount(page, 'Assets', { name: 'Wallet' });
  const assets = accountType(page, 'Assets');
  await expectOrder(assets, ['Cash', 'Wallet']);
  const section = accountsSection(page);
  await expect(section).not.toHaveAttribute('aria-busy', 'true');

  const saving = await holdServerActions(page);
  try {
    await drag(page, grip(assets, 'Wallet'), grip(assets, 'Cash'));
    await expect.poll(saving.held).toBe(1);
    await expect(section).toHaveAttribute('aria-busy', 'true');
    await expectControls(section, false);
  } finally {
    saving.release();
  }

  await expect(section).not.toHaveAttribute('aria-busy', 'true');
  await expectControls(section, true);
  await expectOrder(assets, ['Wallet', 'Cash']);

  await page.reload();
  await expectOrder(assets, ['Wallet', 'Cash']);
});
