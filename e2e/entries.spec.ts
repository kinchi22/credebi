import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  ACCOUNTS,
  AMOUNT,
  DAY,
  entryForm,
  expectDebitAndCreditColumns,
  listedEntry,
  PHONE,
  submitTwoLineEntry,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import { signIn, signInForSmoke } from './session';
import { setEntryFormMode } from './settings';

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

  for (const side of ['Debit', 'Credit'] as const) {
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

test('shows the Debit and Credit pickers side by side on a wide window, and as Debit and Credit tabs at 390px', async ({ page }) => {
  const form = await openTwoLineForm(page);

  await expect(accountChoices(form, 'Debit')).toBeVisible();
  await expect(accountChoices(form, 'Credit')).toBeVisible();
  await expect(form.getByRole('tab')).toHaveCount(0);

  await page.setViewportSize(PHONE);

  const tabs = form.getByRole('tablist');
  await expect(tabs.getByRole('tab', { name: 'Debit', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Credit', exact: true })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Debit', exact: true }).click();
  await expect(accountChoices(form, 'Debit')).toBeVisible();
  await expect(accountChoices(form, 'Credit')).toBeHidden();

  await tabs.getByRole('tab', { name: 'Credit', exact: true }).click();
  await expect(accountChoices(form, 'Credit')).toBeVisible();
  await expect(accountChoices(form, 'Debit')).toBeHidden();
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
