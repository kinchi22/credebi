import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  ACCOUNTS,
  addAccountButton,
  AMOUNT,
  chooseAccountButton,
  closeSheetButton,
  DAY,
  entryForm,
  expectDebitAndCreditColumns,
  expectSheetOnSide,
  findAnAccount,
  listedEntry,
  NO_ACCOUNT_CHOSEN,
  openTwoLineAccountSheet,
  sheetTab,
  SIDES,
  type Account,
  type Side,
  submitTwoLineEntry,
  submitTwoLineEntryOnPhone,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import { signIn, signInForSmoke } from './session';
import { setEntryFormMode } from './settings';
import { PHONE } from './viewport';

const entries = (page: Page): Locator => page.getByRole('region', { name: 'Entries' });

async function expectListedAsSubmitted(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(DAY);

  const lines = entry.getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('Expenses');
  await expect(lines.nth(0)).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(lines.nth(1)).toContainText('Cash');
  await expect(lines.nth(1)).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
}

async function closeAndReopen(form: Locator, sheet: Locator, side: Side): Promise<Locator> {
  await closeSheetButton(sheet).click();
  await expect(sheet).toBeHidden();
  for (const each of SIDES) {
    await expect(accountChoices(form.page(), each)).toBeHidden();
  }
  return openTwoLineAccountSheet(form, side);
}

async function expectRows(form: Locator, chosen: Readonly<Record<Side, Account>>): Promise<void> {
  for (const side of SIDES) {
    const row = chooseAccountButton(form, side);
    await expect(row).toContainText(chosen[side]);
    await expect(row).not.toContainText(NO_ACCOUNT_CHOSEN);
    for (const other of ACCOUNTS.filter((account) => account !== chosen[side])) {
      await expect(row).not.toContainText(other);
    }
  }
}

async function openTwoLineForm(page: Page): Promise<Locator> {
  await signIn(page);
  await setEntryFormMode(page, 'Two-line mode');
  await page.goto('/entries');
  const form = entryForm(page);
  await expect(form).toBeVisible();
  return form;
}

test('lists a Two-line mode Entry as one debit and one credit line of its amount, under Debit and Credit columns, and after a reload', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  const form = await openTwoLineForm(page);

  await expect(form.getByLabel('Amount')).toHaveCount(1);
  await submitTwoLineEntry(form, { day: DAY, memo, debitAccount: 'Expenses', creditAccount: 'Cash', amount: AMOUNT });

  const entry = listedEntry(page, memo);
  await expectListedAsSubmitted(entry);
  await expectDebitAndCreditColumns(entries(page));

  await page.reload();
  await expectListedAsSubmitted(entry);
  await expectDebitAndCreditColumns(entries(page));
});

test('offers every Account as a radio on each Side in Two-line mode, and choosing a second Account replaces the first', async ({ page }) => {
  const form = await openTwoLineForm(page);

  for (const side of SIDES) {
    await expect(accountChoices(form, side)).toBeVisible();
    await expect(accountChoices(form, side).getByRole('radio')).toHaveCount(ACCOUNTS.length);
    for (const account of ACCOUNTS) {
      await expect(accountChoice(form, side, account)).toBeVisible();
    }
  }

  await accountChoice(form, 'Debit', 'Cash').check();
  await expect(accountChoice(form, 'Debit', 'Cash')).toBeChecked();

  await accountChoice(form, 'Debit', 'Expenses').check();
  await expect(accountChoice(form, 'Debit', 'Expenses')).toBeChecked();
  await expect(accountChoice(form, 'Debit', 'Cash')).not.toBeChecked();
  await expect(accountChoices(form, 'Debit').getByRole('radio', { checked: true })).toHaveCount(1);

  await accountChoice(form, 'Credit', 'Expenses').check();
  await expect(accountChoice(form, 'Credit', 'Expenses')).toBeChecked();
  await expect(accountChoice(form, 'Debit', 'Expenses')).toBeChecked();
});

test('shows the Debit and Credit pickers side by side on a wide window, with no tabs and no Add account buttons', async ({ page }) => {
  const form = await openTwoLineForm(page);

  await expect(accountChoices(form, 'Debit')).toBeVisible();
  await expect(accountChoices(form, 'Credit')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  for (const side of SIDES) {
    await expect(addAccountButton(form, side)).toBeHidden();
  }
});

test('hides the Account pickers at 390px until Choose debit account or Choose credit account opens Choose accounts on that Side', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  for (const side of SIDES) {
    await expect(chooseAccountButton(form, side)).toBeVisible();
    await expect(chooseAccountButton(form, side)).toContainText(NO_ACCOUNT_CHOSEN);
    await expect(addAccountButton(form, side)).toBeHidden();
    await expect(accountChoices(page, side)).toBeHidden();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const sheet = await openTwoLineAccountSheet(form, 'Credit');
  await expectSheetOnSide(sheet, 'Credit');
  await expect(findAnAccount(sheet)).toBeVisible();
  await expect(sheet.getByText('Recent')).toHaveCount(0);
  await expect(accountChoices(sheet, 'Credit').getByRole('radio')).toHaveCount(ACCOUNTS.length);
  await expect(accountChoices(sheet, 'Debit')).toBeHidden();

  await sheetTab(sheet, 'Debit').click();
  await expectSheetOnSide(sheet, 'Debit');
  await expect(accountChoices(sheet, 'Debit').getByRole('radio')).toHaveCount(ACCOUNTS.length);
  await expect(accountChoices(sheet, 'Credit')).toBeHidden();

  const reopened = await closeAndReopen(form, sheet, 'Debit');
  await expectSheetOnSide(reopened, 'Debit');
});

test('has no Done button in Choose accounts at 390px in Two-line mode, and its Close button closes it keeping the Accounts chosen', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toBeHidden();
  await expect(closeSheetButton(sheet)).toBeVisible();

  await accountChoice(sheet, 'Debit', 'Cash').check();
  await expectSheetOnSide(sheet, 'Credit');

  const reopened = await closeAndReopen(form, sheet, 'Credit');
  await expect(chooseAccountButton(form, 'Debit')).toContainText('Cash');
  await expect(chooseAccountButton(form, 'Debit')).not.toContainText(NO_ACCOUNT_CHOSEN);
  await expect(chooseAccountButton(form, 'Credit')).toContainText(NO_ACCOUNT_CHOSEN);

  await expectSheetOnSide(reopened, 'Credit');
  await expect(accountChoices(reopened, 'Credit').getByRole('radio', { checked: true })).toHaveCount(0);
  await sheetTab(reopened, 'Debit').click();
  await expect(accountChoice(reopened, 'Debit', 'Cash')).toBeChecked();
});

test('narrows the Accounts in Choose accounts at 390px to those whose name contains the text typed in Find an account', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await findAnAccount(sheet).fill('es');

  const debit = accountChoices(sheet, 'Debit');
  await expect(debit.getByRole('radio')).toHaveCount(2);
  await expect(accountChoice(sheet, 'Debit', 'Sales')).toBeVisible();
  await expect(accountChoice(sheet, 'Debit', 'Expenses')).toBeVisible();
  for (const account of ['Cash', 'Accounts payable', 'Capital'] as const) {
    await expect(accountChoice(sheet, 'Debit', account)).toBeHidden();
  }
});

test('selects the Credit tab at 390px once a Debit Account is chosen while Credit has none, and closes Choose accounts once both Sides have one, showing each in its row', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await accountChoice(sheet, 'Debit', 'Cash').check();
  await expectSheetOnSide(sheet, 'Credit');

  await accountChoice(sheet, 'Credit', 'Expenses').check();
  await expect(sheet).toBeHidden();
  await expectRows(form, { Debit: 'Cash', Credit: 'Expenses' });
});

test('selects the Debit tab at 390px once a Credit Account is chosen while Debit has none', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openTwoLineAccountSheet(form, 'Credit');
  await accountChoice(sheet, 'Credit', 'Sales').check();
  await expectSheetOnSide(sheet, 'Debit');
  await expect(chooseAccountButton(form, 'Credit')).toContainText('Sales');

  await accountChoice(sheet, 'Debit', 'Cash').check();
  await expect(sheet).toBeHidden();
  await expectRows(form, { Debit: 'Cash', Credit: 'Sales' });
});

test('closes Choose accounts at 390px when an Account is changed on one Side while both Sides already have one', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const first = await openTwoLineAccountSheet(form, 'Debit');
  await accountChoice(first, 'Debit', 'Cash').check();
  await accountChoice(first, 'Credit', 'Expenses').check();
  await expect(first).toBeHidden();

  const debit = await openTwoLineAccountSheet(form, 'Debit');
  await expectSheetOnSide(debit, 'Debit');
  await expect(accountChoice(debit, 'Debit', 'Cash')).toBeChecked();
  await accountChoice(debit, 'Debit', 'Sales').check();
  await expect(debit).toBeHidden();
  await expectRows(form, { Debit: 'Sales', Credit: 'Expenses' });

  const credit = await openTwoLineAccountSheet(form, 'Credit');
  await expectSheetOnSide(credit, 'Credit');
  await accountChoice(credit, 'Credit', 'Capital').check();
  await expect(credit).toBeHidden();
  await expectRows(form, { Debit: 'Sales', Credit: 'Capital' });
});

test('lists a Two-line mode Entry added at 390px through Choose accounts', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  await submitTwoLineEntryOnPhone(form, { day: DAY, memo, debitAccount: 'Expenses', creditAccount: 'Cash', amount: AMOUNT });

  await expectListedAsSubmitted(listedEntry(page, memo));
});

test('renders the entry form and the list of entries', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto('/entries');

  await expect(entryForm(page)).toBeVisible();
  await expect(entries(page)).toBeVisible();
});

test("does not show one User's Entries to another", async ({ browser }) => {
  const memo = `Private ${randomUUID()}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage);
  await setEntryFormMode(ownerPage, 'Two-line mode');
  await ownerPage.goto('/entries');
  await submitTwoLineEntry(entryForm(ownerPage), {
    day: DAY,
    memo,
    debitAccount: 'Expenses',
    creditAccount: 'Cash',
    amount: AMOUNT,
  });
  await expectListedAsSubmitted(listedEntry(ownerPage, memo));

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await expect(entries(otherPage)).toBeVisible();
  await expect(listedEntry(otherPage, memo)).toHaveCount(0);

  await owner.close();
  await other.close();
});
