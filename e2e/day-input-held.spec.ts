import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  activeFrom,
  activeUntil,
  addOldWallet,
  BOOKS_OPEN,
  openEdit,
  WALLET_ACTIVE_FROM,
  WALLET_ACTIVE_UNTIL,
  WALLET_ENDED,
  WALLET_IN_USE,
} from './accounts';
import { reportDate, reportDateForm } from './assets-and-liabilities';
import { hiddenValue, shownDay } from './day-input';
import { fixToday } from './date-presets';
import { accountChoice, entrySearchForm, intoCash, openEntryForm, postEntries } from './entries';
import { fromField, toField } from './entry-search';
import { periodForm, periodFrom, periodTo } from './income-statement';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH, INCOME_STATEMENT_PATH, withQuery } from './routes';
import { signIn } from './session';

const WALLET = 'Old wallet';

test.beforeEach(async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
});

test('keeps offering the Accounts of the last complete date while the date is retyped, and changes them once a new date is complete', async ({ page }) => {
  await addOldWallet(page);
  const form = await openEntryForm(page, 'Two-line mode');
  const date = form.getByLabel('Date', { exact: true });
  const wallet = accountChoice(form, 'Debit', WALLET);

  await date.fill(shownDay(WALLET_IN_USE));
  await expect(wallet).toHaveCount(1);

  for (const partial of ['2026', '202610', '2026100', '']) {
    await date.fill(partial);
    await expect(date).toHaveValue(partial);
    await expect(wallet, `still offered after the partial date ${partial}`).toHaveCount(1);
  }

  await date.fill(shownDay(WALLET_ENDED));
  await expect(wallet).toHaveCount(0);

  for (const partial of ['2026', '202609', '2026092', '']) {
    await date.fill(partial);
    await expect(wallet, `still not offered after the partial date ${partial}`).toHaveCount(0);
  }

  await date.fill('2026-09-20');
  await expect(wallet).toHaveCount(1);
});

test('keeps offering the Accounts while the date is typed one digit at a time, changing them on the eighth digit', async ({ page }) => {
  await addOldWallet(page);
  const form = await openEntryForm(page, 'Two-line mode');
  const date = form.getByLabel('Date', { exact: true });
  const wallet = accountChoice(form, 'Debit', WALLET);
  await date.fill(shownDay(WALLET_IN_USE));
  await expect(wallet).toHaveCount(1);

  await date.fill('');
  const ended = shownDay(WALLET_ENDED);
  for (let index = 0; index < ended.length; index += 1) {
    await date.pressSequentially(ended.charAt(index));
    await expect(date).toHaveValue(ended.slice(0, index + 1));
    if (index < ended.length - 1) await expect(wallet).toHaveCount(1);
  }

  await expect(wallet).toHaveCount(0);
});

test('keeps the last complete date of Entry search From and To while they are retyped', async ({ page }) => {
  await page.goto(ENTRY_SEARCH_PATH);
  const form = entrySearchForm(page);
  await fromField(page).fill('20260601');
  await toField(page).fill('20260630');

  for (const partial of ['2026', '202607', '']) {
    await fromField(page).fill(partial);
    await toField(page).fill(partial);
    await expect(hiddenValue(form, 'from')).toHaveValue('2026-06-01');
    await expect(hiddenValue(form, 'to')).toHaveValue('2026-06-30');
  }

  await fromField(page).fill('20260701');
  await toField(page).fill('20260731');
  await expect(hiddenValue(form, 'from')).toHaveValue('2026-07-01');
  await expect(hiddenValue(form, 'to')).toHaveValue('2026-07-31');
});

test("keeps the last complete date of the Income statement's From and To while they are retyped", async ({ page }) => {
  await page.goto(INCOME_STATEMENT_PATH);
  const form = periodForm(page);
  await periodFrom(page).fill('20260601');
  await periodTo(page).fill('20260630');

  for (const partial of ['2026', '202607', '']) {
    await periodFrom(page).fill(partial);
    await periodTo(page).fill(partial);
    await expect(hiddenValue(form, 'from')).toHaveValue('2026-06-01');
    await expect(hiddenValue(form, 'to')).toHaveValue('2026-06-30');
  }

  await periodFrom(page).fill('20260701');
  await periodTo(page).fill('20260731');
  await expect(hiddenValue(form, 'from')).toHaveValue('2026-07-01');
  await expect(hiddenValue(form, 'to')).toHaveValue('2026-07-31');
});

test('submits a complete day as the same ISO day as before, in the URL, with the field showing eight digits after a reload', async ({ page }) => {
  const run = randomUUID();
  await postEntries(page, [intoCash('2026-06-10', `Paid in ${run}`, '1000'), intoCash('2026-07-10', `Later ${run}`, '2000')]);
  await fixToday(page, '2026-09-15');
  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await expect(reportDate(page)).toHaveValue('20260915');

  await reportDate(page).fill('20260630');
  await reportDateForm(page).getByRole('button', { name: 'Show', exact: true }).click();

  await expect(page).toHaveURL(withQuery(ASSETS_AND_LIABILITIES_PATH, { date: '2026-06-30' }));
  await page.reload();
  await expect(reportDate(page)).toHaveValue('20260630');
});

test('fills the defaults of each form in eight digits: the entry form day, an Account\'s days, the report day and the period', async ({ page }) => {
  await fixToday(page, '2026-09-15');
  await page.goto(INCOME_STATEMENT_PATH);
  await expect(periodFrom(page)).toHaveValue('20260901');
  await expect(periodTo(page)).toHaveValue('20260930');

  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await expect(reportDate(page)).toHaveValue('20260915');

  await page.goto(`${INCOME_STATEMENT_PATH}?from=2026-06-01&to=2026-06-30`);
  await expect(periodFrom(page)).toHaveValue('20260601');
  await expect(periodTo(page)).toHaveValue('20260630');
});

test('shows the days of an Account in eight digits when it is edited', async ({ page }) => {
  await addOldWallet(page);

  const dialog = await openEdit(page, 'Assets', WALLET);

  await expect(activeFrom(dialog)).toHaveValue(shownDay(WALLET_ACTIVE_FROM));
  await expect(activeUntil(dialog)).toHaveValue(shownDay(WALLET_ACTIVE_UNTIL));
});
