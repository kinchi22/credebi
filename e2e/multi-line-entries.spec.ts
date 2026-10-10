import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountTick,
  accountTicks,
  ACCOUNTS,
  addAccountButton,
  addLine,
  amountShown,
  DAY,
  entries,
  entryForm,
  expectSheetOnSide,
  findAnAccount,
  lineAmount,
  lineGroup,
  lineGroups,
  listedEntry,
  nameOf,
  notActiveAlert,
  notActiveMark,
  openEditEntry,
  submit,
  type AddedAccount,
  type LineAccount,
  openAccountSheet,
  pressDone,
  sheetTab,
  SIDES,
  submitMultiLineEntry,
  submitMultiLineEntryOnPhone,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import { addAccount, BOOKS_OPEN } from './accounts';
import { signIn } from './session';
import { setEntryFormMode } from './settings';
import { PHONE } from './viewport';

async function openMultiLineForm(
  page: Page,
  prepare?: (page: Page) => Promise<void>,
): Promise<Locator> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  if (prepare !== undefined) await prepare(page);
  await setEntryFormMode(page, 'Multi-line mode');
  await page.goto('/entries');
  const form = entryForm(page);
  await expect(accountTicks(form, 'Debit')).toBeVisible();
  return form;
}

test('offers every Account as a checkbox on each Side, and ticking, unticking or Remove adds or drops its line', async ({ page }) => {
  const form = await openMultiLineForm(page);

  for (const side of SIDES) {
    await expect(accountTicks(form, side).getByRole('checkbox')).toHaveCount(ACCOUNTS.length);
    for (const account of ACCOUNTS) {
      await expect(accountTick(form, side, account)).toBeVisible();
      await expect(accountTick(form, side, account)).not.toBeChecked();
    }
  }
  await expect(lineGroups(form)).toHaveCount(0);

  await accountTick(form, 'Debit', 'Expenses').check();
  const expenses = lineGroup(form, 'Debit', 'Expenses');
  await expect(expenses).toBeVisible();
  await expect(lineAmount(form, 'Debit', 'Expenses')).toBeVisible();
  await expect(expenses.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();

  await accountTick(form, 'Credit', 'Cash').check();
  await expect(lineGroup(form, 'Credit', 'Cash')).toBeVisible();
  await expect(lineGroups(form)).toHaveCount(2);

  await accountTick(form, 'Debit', 'Expenses').uncheck();
  await expect(expenses).toHaveCount(0);
  await expect(lineGroup(form, 'Credit', 'Cash')).toBeVisible();

  await lineGroup(form, 'Credit', 'Cash').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(lineGroup(form, 'Credit', 'Cash')).toHaveCount(0);
  await expect(accountTick(form, 'Credit', 'Cash')).not.toBeChecked();
  await expect(lineGroups(form)).toHaveCount(0);
});

test('shows the debit total, the credit total and their difference while the User types', async ({ page }) => {
  const form = await openMultiLineForm(page);

  const debitTotal = form.getByTestId('debit-total');
  const creditTotal = form.getByTestId('credit-total');
  const difference = form.getByTestId('difference');

  await expect(debitTotal).toHaveText(amountShown('0'));
  await expect(creditTotal).toHaveText(amountShown('0'));
  await expect(difference).toHaveText(amountShown('0'));

  await addLine(form, { side: 'Debit', account: 'Expenses', amount: '12500' });
  await expect(debitTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(creditTotal).toHaveText(amountShown('0'));
  await expect(difference).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await addLine(form, { side: 'Credit', account: 'Cash', amount: '12000' });
  await expect(debitTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(creditTotal).toHaveText(amountShown('12,000'));
  await expect(difference).toHaveText(amountShown('500'));

  await addLine(form, { side: 'Credit', account: 'Accounts payable', amount: '500' });
  await expect(creditTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(difference).toHaveText(amountShown('0'));

  await lineAmount(form, 'Credit', 'Accounts payable').fill('1000');
  await expect(creditTotal).toHaveText(amountShown('13,000'));
  await expect(difference).toHaveText(amountShown('-500'));

  await accountTick(form, 'Credit', 'Accounts payable').uncheck();
  await expect(creditTotal).toHaveText(amountShown('12,000'));
  await expect(difference).toHaveText(amountShown('500'));
});

test('lists a posted Entry with its debits first, then its credits, each in the order chosen, and after a reload', async ({ page }) => {
  const memo = `Supplies on account ${randomUUID()}`;
  const form = await openMultiLineForm(page);

  await submitMultiLineEntry(form, {
    day: DAY,
    memo,
    lines: [
      { side: 'Credit', account: 'Sales', amount: '5000' },
      { side: 'Debit', account: 'Expenses', amount: '7000' },
      { side: 'Credit', account: 'Accounts payable', amount: '7500' },
      { side: 'Debit', account: 'Cash', amount: '5500' },
    ],
  });

  const entry = listedEntry(page, memo);
  const expectListedInOrder = async (): Promise<void> => {
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(DAY);

    const lines = entry.getByTestId('entry-line');
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0)).toContainText('Expenses');
    await expect(lines.nth(0)).toContainText(amountShown('7,000'));
    await expect(lines.nth(1)).toContainText('Cash');
    await expect(lines.nth(1)).toContainText(amountShown('5,500'));
    await expect(lines.nth(2)).toContainText('Sales');
    await expect(lines.nth(2)).toContainText(amountShown('5,000'));
    await expect(lines.nth(3)).toContainText('Accounts payable');
    await expect(lines.nth(3)).toContainText(amountShown('7,500'));

    await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  };

  await expectListedInOrder();

  await page.reload();
  await expectListedInOrder();
});

test('refuses an Entry whose debits and credits differ', async ({ page }) => {
  const memo = `Unbalanced ${randomUUID()}`;
  const form = await openMultiLineForm(page);

  await submitMultiLineEntry(form, {
    day: DAY,
    memo,
    lines: [
      { side: 'Debit', account: 'Expenses', amount: '12500' },
      { side: 'Credit', account: 'Cash', amount: '12000' },
    ],
  });

  await expect(form.getByRole('alert')).toContainText(/balance/i);

  await page.reload();
  await expect(entries(page)).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
});

test('hides the Account checkboxes at 390px until Add debit account or Add credit account opens Choose accounts on that Side, narrowed by Find an account', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await page.setViewportSize(PHONE);

  for (const side of SIDES) {
    await expect(addAccountButton(form, side)).toBeVisible();
    await expect(accountTicks(page, side)).toBeHidden();
  }

  const sheet = await openAccountSheet(form, 'Debit');
  await expectSheetOnSide(sheet, 'Debit');
  await expect(accountTicks(sheet, 'Debit').getByRole('checkbox')).toHaveCount(ACCOUNTS.length);
  await expect(sheet.getByText('Recent')).toHaveCount(0);
  await expect(accountTicks(sheet, 'Credit')).toBeHidden();

  await findAnAccount(sheet).fill('es');
  await expect(accountTicks(sheet, 'Debit').getByRole('checkbox')).toHaveCount(2);
  await expect(accountTick(sheet, 'Debit', 'Sales')).toBeVisible();
  await expect(accountTick(sheet, 'Debit', 'Expenses')).toBeVisible();

  await pressDone(sheet);
  const reopened = await openAccountSheet(form, 'Credit');
  await expectSheetOnSide(reopened, 'Credit');
});

test('keeps the tab on the ticked Side at 390px, whether or not the other Side has an Account, and shows a line per ticked Account after Done', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await page.setViewportSize(PHONE);

  const sheet = await openAccountSheet(form, 'Credit');
  await expectSheetOnSide(sheet, 'Credit');
  await accountTick(sheet, 'Credit', 'Cash').check();
  await expect(accountTick(sheet, 'Credit', 'Cash')).toBeChecked();
  await expectSheetOnSide(sheet, 'Credit');

  await sheetTab(sheet, 'Debit').click();
  await expectSheetOnSide(sheet, 'Debit');
  await accountTick(sheet, 'Debit', 'Expenses').check();
  await expect(accountTick(sheet, 'Debit', 'Expenses')).toBeChecked();
  await expectSheetOnSide(sheet, 'Debit');
  await accountTick(sheet, 'Debit', 'Capital').check();
  await expect(accountTick(sheet, 'Debit', 'Capital')).toBeChecked();
  await expectSheetOnSide(sheet, 'Debit');

  await pressDone(sheet);
  await expect(lineGroups(form)).toHaveCount(3);
  await expect(lineGroup(form, 'Credit', 'Cash')).toBeVisible();
  await expect(lineGroup(form, 'Debit', 'Expenses')).toBeVisible();
  await expect(lineGroup(form, 'Debit', 'Capital')).toBeVisible();
});

test('lists a Multi-line mode Entry added at 390px through Choose accounts', async ({ page }) => {
  const memo = `Supplies on account ${randomUUID()}`;
  const form = await openMultiLineForm(page);
  await page.setViewportSize(PHONE);

  await submitMultiLineEntryOnPhone(form, {
    day: DAY,
    memo,
    lines: [
      { side: 'Debit', account: 'Expenses', amount: '12500' },
      { side: 'Credit', account: 'Cash', amount: '12000' },
      { side: 'Credit', account: 'Accounts payable', amount: '500' },
    ],
  });

  const entry = listedEntry(page, memo);
  await expect(entry).toHaveCount(1);
  await expect(entry.getByTestId('entry-line')).toHaveCount(3);
  await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
});

const OLD_WALLET: AddedAccount = { added: 'Old wallet' };

const WALLET_ACTIVE_FROM = '2026-09-01';

const WALLET_IN_USE = '2026-09-15';

const WALLET_STILL_IN_USE = '2026-09-20';

const WALLET_ACTIVE_UNTIL = '2026-09-30';

const WALLET_ENDED = '2026-10-05';

const ALL_LINES: readonly LineAccount[] = ['Expenses', OLD_WALLET, 'Cash'];

const WITHOUT_WALLET: readonly LineAccount[] = ['Expenses', 'Cash'];

async function openMultiLineFormWithOldWallet(page: Page): Promise<Locator> {
  return openMultiLineForm(page, async (settings) => {
    await settings.goto('/settings');
    await addAccount(settings, 'Assets', {
      name: nameOf(OLD_WALLET),
      activeFrom: WALLET_ACTIVE_FROM,
      activeUntil: WALLET_ACTIVE_UNTIL,
    });
  });
}

async function fillWalletLines(form: Locator, memo: string, expenses: string): Promise<void> {
  await form.getByLabel('Date').fill(WALLET_IN_USE);
  await form.getByLabel('Memo').fill(memo);
  await addLine(form, { side: 'Debit', account: 'Expenses', amount: expenses });
  await addLine(form, { side: 'Debit', account: OLD_WALLET, amount: '500' });
  await addLine(form, { side: 'Credit', account: 'Cash', amount: '12500' });
}

async function expectWalletAmounts(form: Locator, expenses: string): Promise<void> {
  await expect(lineGroups(form, OLD_WALLET)).toHaveCount(3);
  await expect(lineAmount(form, 'Debit', 'Expenses')).toHaveValue(expenses);
  await expect(lineAmount(form, 'Debit', OLD_WALLET)).toHaveValue('500');
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue('12500');
}

async function expectWalletLineMarked(form: Locator, expenses: string): Promise<void> {
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toBeVisible();
  await expect(notActiveMark(lineGroup(form, 'Debit', 'Expenses'))).toHaveCount(0);
  await expect(notActiveMark(lineGroup(form, 'Credit', 'Cash'))).toHaveCount(0);
  await expectWalletAmounts(form, expenses);
}

async function expectRefusedForWallet(form: Locator, memo: string, expenses: string): Promise<void> {
  await expect(notActiveAlert(form, 'Debit', OLD_WALLET)).toBeVisible();
  await expect(form.getByLabel('Date')).toHaveValue(WALLET_ENDED);
  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expectWalletLineMarked(form, expenses);
}

async function expectListedLines(
  page: Page,
  memo: string,
  day: string,
  lines: readonly LineAccount[],
): Promise<void> {
  const entry = listedEntry(page, memo);
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(day);
  const shown = entry.getByTestId('entry-line');
  await expect(shown).toHaveCount(lines.length);
  for (const [index, account] of lines.entries()) {
    await expect(shown.nth(index)).toContainText(nameOf(account));
  }
}

async function expectListedLinesAfterReload(
  page: Page,
  memo: string,
  day: string,
  lines: readonly LineAccount[],
): Promise<void> {
  await expectListedLines(page, memo, day, lines);
  await page.reload();
  await expectListedLines(page, memo, day, lines);
}

async function removeWalletLine(form: Locator): Promise<void> {
  await lineGroup(form, 'Debit', OLD_WALLET).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(lineGroup(form, 'Debit', OLD_WALLET)).toHaveCount(0);
}

test('keeps a line whose Account is not active on the chosen day in the form, marked, with its amount, and leaves it out of the totals', async ({ page }) => {
  const form = await openMultiLineFormWithOldWallet(page);
  await fillWalletLines(form, `Wallet ${randomUUID()}`, '12000');
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toHaveCount(0);
  await expect(form.getByTestId('debit-total')).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await form.getByLabel('Date').fill(WALLET_ENDED);
  await expectWalletLineMarked(form, '12000');
  await expect(form.getByTestId('debit-total')).toHaveText(amountShown('12,000'));
  await expect(form.getByTestId('credit-total')).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(form.getByTestId('difference')).toHaveText(amountShown('-500'));

  await form.getByLabel('Date').fill(WALLET_STILL_IN_USE);
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toHaveCount(0);
  await expect(form.getByTestId('debit-total')).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(form.getByTestId('difference')).toHaveText(amountShown('0'));
});

test('posts nothing while a line\'s Account is not active on the chosen day, even when the other lines balance, names that line and keeps the input, and posts only the lines shown once the line is removed', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await openMultiLineFormWithOldWallet(page);
  await fillWalletLines(form, memo, '12500');
  await form.getByLabel('Date').fill(WALLET_ENDED);
  await expectWalletLineMarked(form, '12500');
  await expect(form.getByTestId('difference')).toHaveText(amountShown('0'));

  await submit(form);
  await expectRefusedForWallet(form, memo, '12500');
  await expect(listedEntry(page, memo)).toHaveCount(0);

  await removeWalletLine(form);
  await submit(form);

  await expectListedLinesAfterReload(page, memo, WALLET_ENDED, WITHOUT_WALLET);
});

test('posts every line shown once a day on which the marked line\'s Account is active is chosen', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await openMultiLineFormWithOldWallet(page);
  await fillWalletLines(form, memo, '12000');
  await form.getByLabel('Date').fill(WALLET_ENDED);
  await submit(form);
  await expectRefusedForWallet(form, memo, '12000');

  await form.getByLabel('Date').fill(WALLET_STILL_IN_USE);
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toHaveCount(0);
  await submit(form);

  await expectListedLinesAfterReload(page, memo, WALLET_STILL_IN_USE, ALL_LINES);
});

async function editPostedWalletEntry(page: Page, memo: string): Promise<Locator> {
  const form = await openMultiLineFormWithOldWallet(page);
  await fillWalletLines(form, memo, '12000');
  await submit(form);
  await expectListedLines(page, memo, WALLET_IN_USE, ALL_LINES);

  const dialog = await openEditEntry(listedEntry(page, memo));
  await expectWalletAmounts(dialog, '12000');

  await dialog.getByLabel('Date').fill(WALLET_ENDED);
  await lineAmount(dialog, 'Debit', 'Expenses').fill('12500');
  await expectWalletLineMarked(dialog, '12500');
  await expect(dialog.getByTestId('difference')).toHaveText(amountShown('0'));

  await submit(dialog, 'Save');
  await expectRefusedForWallet(dialog, memo, '12500');
  await expect(dialog).toBeVisible();
  await expectListedLines(page, memo, WALLET_IN_USE, ALL_LINES);
  return dialog;
}

test('saves no edit of an Entry while a line it had names an Account not active on the chosen day, even when the other lines balance, and saves the lines shown once the User removes that line', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const dialog = await editPostedWalletEntry(page, memo);

  await removeWalletLine(dialog);
  await submit(dialog, 'Save');
  await expect(dialog).toBeHidden();

  await expectListedLinesAfterReload(page, memo, WALLET_ENDED, WITHOUT_WALLET);
});

test('keeps every line of an edited Entry when a day on which the marked line\'s Account is active is chosen', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const dialog = await editPostedWalletEntry(page, memo);

  await dialog.getByLabel('Date').fill(WALLET_STILL_IN_USE);
  await lineAmount(dialog, 'Debit', 'Expenses').fill('12000');
  await expect(notActiveMark(lineGroup(dialog, 'Debit', OLD_WALLET))).toHaveCount(0);
  await submit(dialog, 'Save');
  await expect(dialog).toBeHidden();

  await expectListedLinesAfterReload(page, memo, WALLET_STILL_IN_USE, ALL_LINES);
});
