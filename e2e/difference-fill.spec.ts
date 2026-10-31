import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoices,
  accountTick,
  accountTicks,
  addLine,
  amountShown,
  DAY,
  entryForm,
  fillHeading,
  lineAmount,
  lineGroup,
  listedEntry,
  nameOf,
  notActiveMark,
  openEditEntry,
  saveEdit,
  submit,
  type Line,
  type LineAccount,
  type Side,
} from './entries';
import { addOldWallet, BOOKS_OPEN, OLD_WALLET, WALLET_ENDED, WALLET_IN_USE } from './accounts';
import { expectSettingsPageIn, languageChoice, type Language } from './language';
import { signIn } from './session';
import { setEntryFormMode } from './settings';

const FILL_DIFFERENCE = 'Fill difference';

const LARGEST_AMOUNT = String(Number.MAX_SAFE_INTEGER);

const fillButton = (scope: Locator | Page, name = FILL_DIFFERENCE): Locator =>
  scope.getByRole('button', { name, exact: true });

const difference = (form: Locator): Locator => form.getByTestId('difference');

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

async function addLines(form: Locator, lines: readonly Line[]): Promise<void> {
  for (const line of lines) {
    await addLine(form, line);
  }
}

async function tickEmpty(form: Locator, side: Side, account: LineAccount): Promise<void> {
  await accountTick(form, side, account).check();
  await expect(lineAmount(form, side, account)).toHaveValue('');
}

async function expectFillShownDisabled(form: Locator): Promise<void> {
  await expect(fillButton(form)).toBeVisible();
  await expect(fillButton(form)).toBeDisabled();
}

async function fillAndExpect(
  form: Locator,
  side: Side,
  account: LineAccount,
  amount: string,
): Promise<void> {
  await expect(fillButton(form)).toBeEnabled();
  await fillButton(form).click();
  const field = lineAmount(form, side, account);
  await expect(field).toHaveValue(amount);
  await expect(field).toBeFocused();
  await expect(difference(form)).toHaveText(amountShown('0'));
  await expectFillShownDisabled(form);
}

async function expectListed(
  page: Page,
  memo: string,
  lines: readonly { readonly account: LineAccount; readonly amount: RegExp }[],
): Promise<void> {
  const entry = listedEntry(page, memo);
  await expect(entry).toHaveCount(1);
  const shown = entry.getByTestId('entry-line');
  await expect(shown).toHaveCount(lines.length);
  for (const [index, line] of lines.entries()) {
    await expect(shown.nth(index)).toContainText(nameOf(line.account));
    await expect(shown.nth(index)).toContainText(line.amount);
  }
}

test('fills the one empty credit with 1500 after debits of 500 and 1000, balances the Entry and posts it', async ({ page }) => {
  const memo = `Difference fill ${randomUUID()}`;
  const form = await openMultiLineForm(page);
  await fillHeading(form, { day: DAY, memo });
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '500' },
    { side: 'Debit', account: 'Transportation', amount: '1000' },
  ]);
  await tickEmpty(form, 'Credit', 'Cash');
  await expect(difference(form)).toHaveText(amountShown('1,500'));

  await fillAndExpect(form, 'Credit', 'Cash', '1500');
  await expect(form.getByTestId('debit-total')).toHaveText(amountShown('1,500'));
  await expect(form.getByTestId('credit-total')).toHaveText(amountShown('1,500'));

  await submit(form);
  await expectListed(page, memo, [
    { account: 'Food', amount: amountShown('500') },
    { account: 'Transportation', amount: amountShown('1,000') },
    { account: 'Cash', amount: amountShown('1,500') },
  ]);
});

test('fills only what the short Side still lacks when it already holds an amount', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '500' },
    { side: 'Debit', account: 'Transportation', amount: '1000' },
    { side: 'Credit', account: 'Cash', amount: '1000' },
  ]);
  await tickEmpty(form, 'Credit', 'Credit card payable');
  await expect(difference(form)).toHaveText(amountShown('500'));

  await fillAndExpect(form, 'Credit', 'Credit card payable', '500');
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue('1000');
});

test('fills the one empty debit when the debits fall short', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '700' },
    { side: 'Credit', account: 'Cash', amount: '2000' },
  ]);
  await tickEmpty(form, 'Debit', 'Transportation');
  await expect(difference(form)).toHaveText(amountShown('-1,300'));

  await fillAndExpect(form, 'Debit', 'Transportation', '1300');
  await expect(lineAmount(form, 'Debit', 'Food')).toHaveValue('700');
});

test('shows the button disabled at a Difference of 0, with or without an empty line', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await expect(difference(form)).toHaveText(amountShown('0'));
  await expectFillShownDisabled(form);

  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '1500' },
    { side: 'Credit', account: 'Cash', amount: '1500' },
  ]);
  await tickEmpty(form, 'Credit', 'Credit card payable');
  await expect(difference(form)).toHaveText(amountShown('0'));
  await expectFillShownDisabled(form);
  await expect(lineAmount(form, 'Credit', 'Credit card payable')).toHaveValue('');
});

test('shows the button disabled while the only empty line is on the Side with the larger total, and fills only the short Side once it has one', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '1500' },
    { side: 'Credit', account: 'Cash', amount: '1000' },
  ]);
  await tickEmpty(form, 'Debit', 'Transportation');
  await expect(difference(form)).toHaveText(amountShown('500'));
  await expectFillShownDisabled(form);

  await tickEmpty(form, 'Credit', 'Credit card payable');
  await fillAndExpect(form, 'Credit', 'Credit card payable', '500');
  await expect(lineAmount(form, 'Debit', 'Transportation')).toHaveValue('');
});

test('shows the button disabled while the short Side has two empty lines, and enabled once one of them holds an amount', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLine(form, { side: 'Debit', account: 'Food', amount: '1500' });
  await tickEmpty(form, 'Credit', 'Cash');
  await tickEmpty(form, 'Credit', 'Credit card payable');
  await expectFillShownDisabled(form);
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue('');
  await expect(lineAmount(form, 'Credit', 'Credit card payable')).toHaveValue('');

  await lineAmount(form, 'Credit', 'Cash').fill('400');
  await fillAndExpect(form, 'Credit', 'Credit card payable', '1100');
});

test('shows the button disabled while the amounts add up to more than an amount can hold', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: LARGEST_AMOUNT },
    { side: 'Debit', account: 'Transportation', amount: '1' },
  ]);
  await tickEmpty(form, 'Credit', 'Cash');
  await expect(form.getByText('These amounts add up to more than an amount can hold.', { exact: true })).toBeVisible();
  await expectFillShownDisabled(form);
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue('');
});

test('counts a spaces-only amount as empty and fills it', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '1500' },
    { side: 'Credit', account: 'Cash', amount: '   ' },
  ]);

  await fillAndExpect(form, 'Credit', 'Cash', '1500');
});

test('neither fills nor counts as empty an amount holding other text', async ({ page }) => {
  const form = await openMultiLineForm(page);
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '1500' },
    { side: 'Credit', account: 'Cash', amount: '1,5oo' },
  ]);
  await expect(difference(form)).toHaveText(amountShown('1,500'));
  await expectFillShownDisabled(form);

  await tickEmpty(form, 'Credit', 'Credit card payable');
  await fillAndExpect(form, 'Credit', 'Credit card payable', '1500');
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue('1,5oo');
});

test('neither fills nor counts as empty a line whose Account is not active on the form\'s day', async ({ page }) => {
  const form = await openMultiLineForm(page, addOldWallet);
  await form.getByLabel('Date').fill(WALLET_IN_USE);
  await addLine(form, { side: 'Debit', account: 'Food', amount: '1500' });
  await tickEmpty(form, 'Credit', OLD_WALLET);
  await expect(fillButton(form)).toBeEnabled();

  await form.getByLabel('Date').fill(WALLET_ENDED);
  await expect(notActiveMark(lineGroup(form, 'Credit', OLD_WALLET))).toBeVisible();
  await expectFillShownDisabled(form);

  await tickEmpty(form, 'Credit', 'Cash');
  await fillAndExpect(form, 'Credit', 'Cash', '1500');
  await expect(lineAmount(form, 'Credit', OLD_WALLET)).toHaveValue('');

  await form.getByLabel('Date').fill(WALLET_IN_USE);
  await expect(notActiveMark(lineGroup(form, 'Credit', OLD_WALLET))).toHaveCount(0);
  await expect(difference(form)).toHaveText(amountShown('0'));
  await expectFillShownDisabled(form);
});

test('fills the Difference in Edit entry, and saves the filled Entry as listed', async ({ page }) => {
  const memo = `Difference fill edit ${randomUUID()}`;
  const form = await openMultiLineForm(page);
  await fillHeading(form, { day: DAY, memo });
  await addLines(form, [
    { side: 'Debit', account: 'Food', amount: '500' },
    { side: 'Debit', account: 'Transportation', amount: '1000' },
    { side: 'Credit', account: 'Cash', amount: '1500' },
  ]);
  await submit(form);
  await expect(listedEntry(page, memo)).toHaveCount(1);

  const dialog = await openEditEntry(listedEntry(page, memo));
  await expectFillShownDisabled(dialog);
  await lineAmount(dialog, 'Debit', 'Food').fill('800');
  await expectFillShownDisabled(dialog);
  await tickEmpty(dialog, 'Credit', 'Credit card payable');
  await fillAndExpect(dialog, 'Credit', 'Credit card payable', '300');

  await saveEdit(dialog);
  await expectListed(page, memo, [
    { account: 'Food', amount: amountShown('800') },
    { account: 'Transportation', amount: amountShown('1,000') },
    { account: 'Cash', amount: amountShown('1,500') },
    { account: 'Credit card payable', amount: amountShown('300') },
  ]);
});

test('shows no Fill difference button in Two-line mode', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await setEntryFormMode(page, 'Two-line mode');
  await page.goto('/entries');
  const form = entryForm(page);
  await expect(accountChoices(form, 'Debit')).toBeVisible();
  await expect(form.getByLabel('Amount')).toHaveCount(1);
  await expect(fillButton(page)).toHaveCount(0);
});

const LOCALISED: readonly { readonly language: Language; readonly debitAccounts: string; readonly name: string }[] = [
  { language: 'ko', debitAccounts: '\uCC28\uBCC0 \uACC4\uC815', name: '\uCC28\uC561 \uCC44\uC6B0\uAE30' },
  { language: 'ja', debitAccounts: '\u501F\u65B9\u306E\u52D8\u5B9A\u79D1\u76EE', name: '\u5DEE\u984D\u3092\u5165\u529B' },
];

for (const { language, debitAccounts, name } of LOCALISED) {
  test(`names the button in the ${language} catalogue when the app is shown in that Language`, async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    await setEntryFormMode(page, 'Multi-line mode');
    await languageChoice(page, 'en', language).check();
    await expectSettingsPageIn(page, language);

    await page.goto('/entries');
    await expect(page.getByRole('group', { name: debitAccounts, exact: true })).toBeVisible();
    await expect(fillButton(page, name)).toBeVisible();
    await expect(fillButton(page)).toHaveCount(0);
  });
}
