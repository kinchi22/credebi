import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { addAccount, BOOKS_OPEN } from './accounts';
import { expectMonths, type TrendMonth } from './assets-and-liabilities-trend';
import {
  added,
  deleteListed,
  entryOn,
  listedEntry,
  openEditEntry,
  postEntries,
  saveEdit,
  type TwoLineEntry,
} from './entries';
import { SETTINGS_PATH, TREND_PATH as TREND } from './routes';
import { signIn } from './session';

const IN_JUNE = '2026-06-15';

const intoCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Cash', 'Opening balance equity', amount);

const outOfCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Food', 'Cash', amount);

const cash = (month: string, amount: string): TrendMonth => [month, amount, '0', amount];

const noBalance = (month: string): TrendMonth => [month, '0', '0', '0'];

async function openTrend(page: Page, from: string, to: string): Promise<void> {
  await page.goto(`${TREND}?from=${from}&to=${to}`);
}

test("accumulates each month's balances from the start of the books through its last day, rather than showing that month's movement", async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2026-06-10', `Paid in ${run}`, '10000'),
    outOfCash('2026-07-20', `Spent ${run}`, '3000'),
  ]);

  await openTrend(page, '2026-05', '2026-08');

  await expectMonths(page, [
    noBalance('2026-05'),
    cash('2026-06', '10,000'),
    cash('2026-07', '7,000'),
    cash('2026-08', '7,000'),
  ]);
});

test("counts an Entry on a month's last day in that month, and one on the next day only from the next month", async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2026-06-30', `Last day ${run}`, '1000'),
    intoCash('2026-07-01', `Next day ${run}`, '2000'),
  ]);

  await openTrend(page, '2026-06', '2026-07');

  await expectMonths(page, [cash('2026-06', '1,000'), cash('2026-07', '3,000')]);
});

test('moves the earlier months when an Entry is written for a month before those already recorded', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-07-15', `July ${run}`, '1000')]);
  await openTrend(page, '2026-05', '2026-07');
  await expectMonths(page, [noBalance('2026-05'), noBalance('2026-06'), cash('2026-07', '1,000')]);

  await postEntries(page, [intoCash('2026-05-15', `Backdated to May ${run}`, '500')]);
  await openTrend(page, '2026-05', '2026-07');

  await expectMonths(page, [cash('2026-05', '500'), cash('2026-06', '500'), cash('2026-07', '1,500')]);
});

test('balances an asset Account as its debits less its credits and a liability Account as its credits less its debits, keeping the minus sign of a negative balance and a negative Net worth', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const bank = added('Overdrawn bank');
  const card = added('Card');
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Overdrawn bank', activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Liabilities', { name: 'Card', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    intoCash(IN_JUNE, `Paid in ${run}`, '5000'),
    outOfCash(IN_JUNE, `Spent ${run}`, '1000'),
    entryOn(IN_JUNE, `Overdrawn ${run}`, 'Food', bank, '7500'),
    entryOn(IN_JUNE, `Charged ${run}`, 'Food', card, '9000'),
    entryOn(IN_JUNE, `Card repaid ${run}`, card, 'Cash', '500'),
    entryOn(IN_JUNE, `Card overpaid ${run}`, 'Credit card payable', 'Opening balance equity', '1200'),
  ]);

  await openTrend(page, '2026-05', '2026-06');

  await expectMonths(page, [noBalance('2026-05'), ['2026-06', '-4,000', '7,300', '-11,300']]);
});

test('leaves out a deleted Entry and the Entry a Correction replaced, and counts the replacement', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const deleted = `Deleted ${run}`;
  const corrected = `Corrected ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash(IN_JUNE, `Paid in ${run}`, '10000'),
    outOfCash(IN_JUNE, `Kept ${run}`, '1000'),
    outOfCash(IN_JUNE, deleted, '2000'),
    outOfCash(IN_JUNE, corrected, '4000'),
  ]);

  await page.goto('/entries');
  await deleteListed(listedEntry(page, deleted));
  await expect(listedEntry(page, deleted)).toHaveCount(0);
  const dialog = await openEditEntry(listedEntry(page, corrected));
  await dialog.getByLabel('Amount').fill('3000');
  await saveEdit(dialog);

  await openTrend(page, '2026-06', '2026-07');

  await expectMonths(page, [cash('2026-06', '6,000'), cash('2026-07', '6,000')]);
});

test('counts an asset or liability Account from the month its Active period starts, even on its last day, and not in the month before', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Wallet', activeFrom: '2026-06-30' });
  await addAccount(page, 'Liabilities', { name: 'Tab', activeFrom: '2026-06-20' });
  await postEntries(page, [
    entryOn('2026-06-30', `Filled ${run}`, added('Wallet'), 'Opening balance equity', '4000'),
    entryOn('2026-06-20', `Ran up ${run}`, 'Food', added('Tab'), '1000'),
  ]);

  await openTrend(page, '2026-05', '2026-07');

  await expectMonths(page, [
    noBalance('2026-05'),
    ['2026-06', '4,000', '1,000', '3,000'],
    ['2026-07', '4,000', '1,000', '3,000'],
  ]);
});

test('counts an Account with a balance in every month its Active period overlaps, even by one day, and from the month after it ends leaves it out of the totals and Net worth', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Deposit', activeFrom: BOOKS_OPEN, activeUntil: IN_JUNE });
  await addAccount(page, 'Assets', { name: 'Short fund', activeFrom: BOOKS_OPEN, activeUntil: '2026-07-01' });
  await addAccount(page, 'Liabilities', { name: 'Old loan', activeFrom: BOOKS_OPEN, activeUntil: IN_JUNE });
  await postEntries(page, [
    entryOn('2026-06-10', `Deposited ${run}`, added('Deposit'), 'Opening balance equity', '4000'),
    entryOn('2026-06-10', `Invested ${run}`, added('Short fund'), 'Opening balance equity', '500'),
    entryOn('2026-06-10', `Borrowed ${run}`, 'Food', added('Old loan'), '3000'),
  ]);

  await openTrend(page, '2026-05', '2026-08');

  await expectMonths(page, [
    noBalance('2026-05'),
    ['2026-06', '4,500', '3,000', '1,500'],
    cash('2026-07', '500'),
    noBalance('2026-08'),
  ]);
});

test('leaves equity, revenue and expense Accounts out of total assets, total liabilities and Net worth', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    entryOn(IN_JUNE, `Paid ${run}`, 'Cash', 'Salary', '3000'),
    outOfCash(IN_JUNE, `Lunch ${run}`, '1000'),
    intoCash(IN_JUNE, `Opening ${run}`, '2000'),
  ]);

  await openTrend(page, '2026-06', '2026-06');

  await expectMonths(page, [cash('2026-06', '4,000')]);
});
