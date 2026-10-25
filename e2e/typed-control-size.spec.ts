import { expect, test, type Locator } from '@playwright/test';
import { openAdd, openEdit } from './accounts';
import { reportDate } from './assets-and-liabilities';
import { closeDialog } from './dialog';
import {
  accountTick,
  entrySearchForm,
  findAnAccount,
  lineAmount,
  openAccountSheet,
  openEntryForm,
  openTwoLineAccountSheet,
  pressDone,
  titleField,
} from './entries';
import { accountField, fromField, toField } from './entry-search';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { expectTypedWithoutZoom, PHONE } from './viewport';

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
});

async function expectHeadingTypedWithoutZoom(form: Locator): Promise<void> {
  await expectTypedWithoutZoom(form.getByLabel('Date', { exact: true }));
  await expectTypedWithoutZoom(titleField(form));
  await expectTypedWithoutZoom(form.getByLabel('Memo', { exact: true }));
}

async function expectAccountFieldsTypedWithoutZoom(dialog: Locator): Promise<void> {
  for (const label of ['Name', 'Description', 'Group', 'Active from', 'Active until']) {
    await expectTypedWithoutZoom(dialog.getByLabel(label, { exact: true }));
  }
}

test('sets Date, Title, Memo, Amount and Find an account in the two-line entry form at 16px or more at 390px', async ({ page }) => {
  const form = await openEntryForm(page, 'Two-line mode');

  await expectHeadingTypedWithoutZoom(form);
  await expectTypedWithoutZoom(form.getByLabel('Amount', { exact: true }));

  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await expectTypedWithoutZoom(findAnAccount(sheet));
});

test('sets Date, Title, Memo, every line Amount and Find an account in the multi-line entry form at 16px or more at 390px', async ({ page }) => {
  const form = await openEntryForm(page, 'Multi-line mode');

  await expectHeadingTypedWithoutZoom(form);

  const debit = await openAccountSheet(form, 'Debit');
  await expectTypedWithoutZoom(findAnAccount(debit));
  await accountTick(debit, 'Debit', 'Expenses').check();
  await pressDone(debit);

  const credit = await openAccountSheet(form, 'Credit');
  await accountTick(credit, 'Credit', 'Cash').check();
  await pressDone(credit);

  await expectTypedWithoutZoom(lineAmount(form, 'Debit', 'Expenses'));
  await expectTypedWithoutZoom(lineAmount(form, 'Credit', 'Cash'));
});

test('sets From, To, Account, Title and Memo in Entry search at 16px or more at 390px', async ({ page }) => {
  await page.goto(ENTRY_SEARCH_PATH);
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();

  await expectTypedWithoutZoom(fromField(page));
  await expectTypedWithoutZoom(toField(page));
  await expectTypedWithoutZoom(accountField(page));
  await expectTypedWithoutZoom(titleField(form));
  await expectTypedWithoutZoom(form.getByLabel('Memo', { exact: true }));
});

test('sets Name, Description, Group, Active from and Active until in the Add account dialog at 16px or more at 390px', async ({ page }) => {
  await page.goto(SETTINGS_PATH);

  const dialog = await openAdd(page, 'Assets', 'account');
  await expectAccountFieldsTypedWithoutZoom(dialog);
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
});

test('sets Name, Description, Group, Active from and Active until in the Edit account dialog at 16px or more at 390px', async ({ page }) => {
  await page.goto(SETTINGS_PATH);

  const dialog = await openEdit(page, 'Assets', 'Cash');
  await expectAccountFieldsTypedWithoutZoom(dialog);
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
});

test('sets Date in Assets and liabilities at 16px or more at 390px', async ({ page }) => {
  await page.goto(ASSETS_AND_LIABILITIES_PATH);

  await expectTypedWithoutZoom(reportDate(page));
});
