import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  ACCOUNTS,
  accountSheet,
  addAccountButton,
  AMOUNT,
  closeAccountSheet,
  DAY,
  entryForm,
  expectDebitAndCreditColumns,
  expectSheetOnSide,
  findAnAccount,
  listedEntry,
  openAccountSheet,
  sheetTab,
  SIDES,
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

test('hides the Account pickers at 390px until Add debit account or Add credit account opens Choose accounts on that Side', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  for (const side of SIDES) {
    await expect(addAccountButton(form, side)).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: `${side} account`, exact: true })).toBeHidden();
  }
  await expect(accountSheet(page)).toBeHidden();

  const sheet = await openAccountSheet(form, 'Credit');
  await expectSheetOnSide(sheet, 'Credit');
  await expect(findAnAccount(sheet)).toBeVisible();
  await expect(accountChoices(sheet, 'Credit').getByRole('radio')).toHaveCount(ACCOUNTS.length);
  await expect(accountChoices(sheet, 'Debit')).toBeHidden();

  await sheetTab(sheet, 'Debit').click();
  await expectSheetOnSide(sheet, 'Debit');
  await expect(accountChoices(sheet, 'Debit').getByRole('radio')).toHaveCount(ACCOUNTS.length);
  await expect(accountChoices(sheet, 'Credit')).toBeHidden();

  await closeAccountSheet(sheet);
  for (const side of SIDES) {
    await expect(page.getByRole('radiogroup', { name: `${side} account`, exact: true })).toBeHidden();
  }

  await openAccountSheet(form, 'Debit');
  await expectSheetOnSide(sheet, 'Debit');
});

test('narrows the Accounts in Choose accounts at 390px to those whose name contains the text typed in Find an account', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openAccountSheet(form, 'Debit');
  await findAnAccount(sheet).fill('es');

  const debit = accountChoices(sheet, 'Debit');
  await expect(debit.getByRole('radio')).toHaveCount(2);
  await expect(accountChoice(sheet, 'Debit', 'Sales')).toBeVisible();
  await expect(accountChoice(sheet, 'Debit', 'Expenses')).toBeVisible();
  for (const account of ['Cash', 'Accounts payable', 'Capital'] as const) {
    await expect(accountChoice(sheet, 'Debit', account)).toBeHidden();
  }
});

test('selects the Credit tab at 390px once a Debit Account is chosen while Credit has none, keeps the tab while the other Side has one, and shows the chosen Accounts in the form after Done', async ({ page }) => {
  const form = await openTwoLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openAccountSheet(form, 'Debit');
  await accountChoice(sheet, 'Debit', 'Cash').check();
  await expectSheetOnSide(sheet, 'Credit');

  await accountChoice(sheet, 'Credit', 'Expenses').check();
  await expectSheetOnSide(sheet, 'Credit');

  await sheetTab(sheet, 'Debit').click();
  await accountChoice(sheet, 'Debit', 'Sales').check();
  await expectSheetOnSide(sheet, 'Debit');
  await expect(accountChoice(sheet, 'Debit', 'Sales')).toBeChecked();

  await closeAccountSheet(sheet);
  const shownInForm = (account: string): Locator =>
    form.getByText(account, { exact: true }).filter({ visible: true });
  await expect(shownInForm('Sales')).toHaveCount(1);
  await expect(shownInForm('Expenses')).toHaveCount(1);
  await expect(shownInForm('Cash')).toHaveCount(0);
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
