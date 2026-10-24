import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN, dayInBrowser } from './accounts';
import { choosePreset, fixToday } from './date-presets';
import {
  deleteListed,
  type LineAccount,
  listedEntry,
  openEditEntry,
  postEntries,
  saveEdit,
  type TwoLineEntry,
} from './entries';
import { accountField, EARLIEST, fromField, LATEST, resultFor, toField } from './entry-search';
import {
  accountLink,
  expectPeriod,
  expectStatement,
  periodForm,
  showStatement,
  statementTable,
  statementTables,
} from './income-statement';
import {
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH as STATEMENT,
  INCOME_STATEMENT_WITH_QUERY,
  INCOME_STATEMENT_WITHOUT_QUERY,
  SIGN_IN_URL,
} from './routes';
import { freshIdentifier, signIn, signInForSmoke, submitTestSignIn } from './session';
import { expectWithinPhone, PHONE } from './viewport';

const TODAY = '2026-09-15';

const JUNE_FIRST = '2026-06-01';

const JUNE_LAST = '2026-06-30';

const IN_JUNE = '2026-06-15';

const LONG_NAME = 'Memberships paid for every single month';

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const posting = (
  day: string,
  memo: string,
  debitAccount: LineAccount,
  creditAccount: LineAccount,
  amount: string,
): TwoLineEntry => ({ day, memo, debitAccount, creditAccount, amount });

const spent = (day: string, memo: string, amount: string, account: LineAccount = 'Expenses'): TwoLineEntry =>
  posting(day, memo, account, 'Cash', amount);

const earned = (day: string, memo: string, amount: string, account: LineAccount = 'Sales'): TwoLineEntry =>
  posting(day, memo, 'Cash', account, amount);

const added = (name: string): LineAccount => ({ added: name });

const nothingCounted = {
  revenue: [['Sales', '0']],
  totalRevenue: '0',
  expenses: [['Expenses', '0']],
  totalExpense: '0',
  difference: '0',
} as const;

function queryOf(page: Page): Record<string, string> {
  return Object.fromEntries(new URL(page.url()).searchParams);
}

test('opens with no query on the calendar month holding the browser\'s day, filled into From and To, and counts only its Entries', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    spent('2026-08-31', `Before the month ${run}`, '1000'),
    spent('2026-09-01', `First day ${run}`, '2000'),
    spent('2026-09-30', `Last day ${run}`, '4000'),
    spent('2026-10-01', `After the month ${run}`, '8000'),
    spent('2028-02-29', `Leap day ${run}`, '16000'),
  ]);

  await fixToday(page, TODAY);
  await page.goto(STATEMENT);

  await expect(periodForm(page)).toBeVisible();
  await expectPeriod(page, '2026-09-01', '2026-09-30');
  await expectStatement(page, {
    revenue: [['Sales', '0']],
    totalRevenue: '0',
    expenses: [['Expenses', '6,000']],
    totalExpense: '6,000',
    difference: '-6,000',
  });
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);

  await fixToday(page, '2028-02-10');
  await page.goto(STATEMENT);

  await expectPeriod(page, '2028-02-01', '2028-02-29');
  await expectStatement(page, {
    revenue: [['Sales', '0']],
    totalRevenue: '0',
    expenses: [['Expenses', '16,000']],
    totalExpense: '16,000',
    difference: '-16,000',
  });
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);
});

test('puts a range chosen with From and To into the URL, which a reload and the back button keep', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    spent(IN_JUNE, `June ${run}`, '1000'),
    spent('2026-07-15', `July ${run}`, '2000'),
  ]);
  const june = { ...nothingCounted, expenses: [['Expenses', '1,000']], totalExpense: '1,000', difference: '-1,000' } as const;
  const july = { ...nothingCounted, expenses: [['Expenses', '2,000']], totalExpense: '2,000', difference: '-2,000' } as const;

  await fixToday(page, TODAY);
  await page.goto(STATEMENT);
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);

  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expect(page).toHaveURL(INCOME_STATEMENT_WITH_QUERY);
  expect(queryOf(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectStatement(page, june);

  await showStatement(page, '2026-07-01', '2026-07-31');
  expect(queryOf(page)).toMatchObject({ from: '2026-07-01', to: '2026-07-31' });
  await expectStatement(page, july);

  await page.goBack();
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, june);

  await page.reload();
  expect(queryOf(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, june);
});

test('fills From and To from a date preset and shows the statement for it, with the range in the URL', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    spent(IN_JUNE, `June ${run}`, '1000'),
    spent('2025-12-31', `Last year ${run}`, '2000'),
  ]);

  await fixToday(page, TODAY);
  await page.goto(STATEMENT);

  await choosePreset(page, 'Month', 'Jun 2026');
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
  await expect(page).toHaveURL(INCOME_STATEMENT_WITH_QUERY);
  expect(queryOf(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectStatement(page, {
    ...nothingCounted,
    expenses: [['Expenses', '1,000']],
    totalExpense: '1,000',
    difference: '-1,000',
  });

  await choosePreset(page, 'Year', '2025');
  await expectPeriod(page, '2025-01-01', '2025-12-31');
  expect(queryOf(page)).toMatchObject({ from: '2025-01-01', to: '2025-12-31' });
  await expectStatement(page, {
    ...nothingCounted,
    expenses: [['Expenses', '2,000']],
    totalExpense: '2,000',
    difference: '-2,000',
  });
});

test('refuses a range whose From is later than its To, explains itself, and shows no statement', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(STATEMENT);

  await showStatement(page, JUNE_LAST, JUNE_FIRST);

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/range/i);
  await expect(statementTables(page)).toHaveCount(0);
});

test('totals a revenue Account as its credits less its debits and an expense Account as its debits less its credits, showing a total below zero as negative', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const travel = added('Travel');
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: 'Travel', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    earned(IN_JUNE, `Sale ${run}`, '12500'),
    posting(IN_JUNE, `Sale returned ${run}`, 'Sales', 'Cash', '3000'),
    spent(IN_JUNE, `Supplies ${run}`, '4000'),
    posting(IN_JUNE, `Supplies refunded ${run}`, 'Cash', 'Expenses', '1000'),
    posting(IN_JUNE, `Fare refunded ${run}`, 'Cash', travel, '5000'),
  ]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);

  await expectStatement(page, {
    revenue: [['Sales', '9,500']],
    totalRevenue: '9,500',
    expenses: [['Expenses', '3,000'], ['Travel', '-5,000']],
    totalExpense: '-2,000',
    difference: '11,500',
  });
});

test('counts an Entry by its calendar day, not the day it was written', async ({ page }) => {
  test.slow();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [spent(IN_JUNE, `Backdated ${randomUUID()}`, '7000')]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, {
    ...nothingCounted,
    expenses: [['Expenses', '7,000']],
    totalExpense: '7,000',
    difference: '-7,000',
  });

  const today = await dayInBrowser(page);
  await showStatement(page, today, today);
  await expectStatement(page, nothingCounted);
});

test('leaves out a deleted Entry and the Entry a Correction replaced, and counts the replacement, over a range of any length', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const kept = `Kept ${run}`;
  const deleted = `Deleted ${run}`;
  const corrected = `Corrected ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    spent(IN_JUNE, kept, '1000'),
    spent(IN_JUNE, deleted, '2000'),
    spent(IN_JUNE, corrected, '4000'),
  ]);

  await page.goto('/entries');
  await deleteListed(listedEntry(page, deleted));
  await expect(listedEntry(page, deleted)).toHaveCount(0);
  const dialog = await openEditEntry(listedEntry(page, corrected));
  await dialog.getByLabel('Amount').fill('3000');
  await saveEdit(dialog);

  const counted = {
    ...nothingCounted,
    expenses: [['Expenses', '4,000']],
    totalExpense: '4,000',
    difference: '-4,000',
  } as const;
  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, counted);

  await showStatement(page, EARLIEST, LATEST);
  await expectStatement(page, counted);
});

test('lists each revenue and expense Account whose Active period overlaps the range, at zero when no Entry names it, and leaves out one active only outside it', async ({ page }) => {
  test.slow();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Revenue', { name: 'Old sales', activeFrom: '2026-01-01', activeUntil: '2026-05-31' });
  await addAccount(page, 'Revenue', { name: 'New sales', activeFrom: '2026-06-30' });
  await addAccount(page, 'Expenses', { name: 'Ended before', activeFrom: '2026-01-01', activeUntil: '2026-05-31' });
  await addAccount(page, 'Expenses', { name: 'Ends on the first', activeFrom: '2026-01-01', activeUntil: JUNE_FIRST });
  await addAccount(page, 'Expenses', { name: 'Starts on the last', activeFrom: JUNE_LAST });
  await addAccount(page, 'Expenses', { name: 'Starts after', activeFrom: '2026-07-01' });

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);

  await expectStatement(page, {
    revenue: [['Sales', '0'], ['New sales', '0']],
    totalRevenue: '0',
    expenses: [['Expenses', '0'], ['Ends on the first', '0'], ['Starts on the last', '0']],
    totalExpense: '0',
    difference: '0',
  });
});

test('puts each Account under its Account group with the group\'s subtotal, in Chart of accounts order, and leaves out a group with no listed Account', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addGroup(page, 'Revenue', { name: 'Salary' });
  await addAccount(page, 'Revenue', { name: 'Base pay', group: 'Salary', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Expenses', { name: 'Food' });
  await addAccount(page, 'Expenses', { name: 'Groceries', group: 'Food', activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Expenses', { name: 'Dining', group: 'Food', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Expenses', { name: 'Empty' });
  await addGroup(page, 'Expenses', { name: 'Retired' });
  await addAccount(page, 'Expenses', {
    name: 'Old club',
    group: 'Retired',
    activeFrom: '2026-01-01',
    activeUntil: '2026-05-31',
  });
  await addAccount(page, 'Expenses', { name: 'Rent', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    earned(IN_JUNE, `Pay ${run}`, '10000', added('Base pay')),
    spent(IN_JUNE, `Stationery ${run}`, '1000'),
    spent(IN_JUNE, `Market ${run}`, '2000', added('Groceries')),
    spent(IN_JUNE, `Dinner ${run}`, '3000', added('Dining')),
  ]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);

  await expectStatement(page, {
    revenue: [['Sales', '0'], ['Salary', '10,000'], ['Base pay', '10,000']],
    totalRevenue: '10,000',
    expenses: [
      ['Expenses', '1,000'],
      ['Food', '5,000'],
      ['Groceries', '2,000'],
      ['Dining', '3,000'],
      ['Rent', '0'],
    ],
    totalExpense: '6,000',
    difference: '4,000',
  });
  await expect(statementTable(page, 'Revenue').getByRole('link')).toHaveText(['Sales', 'Base pay']);
  await expect(statementTable(page, 'Expenses').getByRole('link')).toHaveText([
    'Expenses',
    'Groceries',
    'Dining',
    'Rent',
  ]);
});

test('links an Account to Entry search with that Account and the same range', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const market = `Market ${run}`;
  const stationery = `Stationery ${run}`;
  const july = `July market ${run}`;
  const groceries = added('Groceries');
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: 'Groceries', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    spent(IN_JUNE, market, '2000', groceries),
    spent(IN_JUNE, stationery, '1000'),
    spent('2026-07-15', july, '4000', groceries),
  ]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await accountLink(page, 'Expenses', 'Groceries').click();

  await expect(page).toHaveURL((url) => url.pathname === ENTRY_SEARCH_PATH);
  const query = queryOf(page);
  expect(query).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  expect(query['account'] ?? '').toMatch(ACCOUNT_ID);
  await expect(accountField(page)).toHaveValue('Groceries');
  await expect(fromField(page)).toHaveValue(JUNE_FIRST);
  await expect(toField(page)).toHaveValue(JUNE_LAST);
  await expect(resultFor(page, market)).toHaveCount(1);
  await expect(resultFor(page, stationery)).toHaveCount(0);
  await expect(resultFor(page, july)).toHaveCount(0);
});

test("counts no other User's Entries, and shows both sections and their totals at zero when nothing counts", async ({ browser }) => {
  test.slow();
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage, { accountsStartOn: BOOKS_OPEN });
  await postEntries(ownerPage, [
    spent(IN_JUNE, `Private spending ${randomUUID()}`, '1000'),
    earned(IN_JUNE, `Private sale ${randomUUID()}`, '2000'),
  ]);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, { accountsStartOn: BOOKS_OPEN });
  await otherPage.goto(STATEMENT);
  await showStatement(otherPage, JUNE_FIRST, JUNE_LAST);

  await expectStatement(otherPage, nothingCounted);

  await owner.close();
  await other.close();
});

test('sends a signed-out visitor to sign in, and back to the Income statement once signed in', async ({ page }) => {
  await page.goto(STATEMENT);
  await expect(page).toHaveURL(SIGN_IN_URL);

  await submitTestSignIn(page, freshIdentifier());

  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);
  await expect(periodForm(page)).toBeVisible();
});

test('shows each Account with one amount within the screen at 390px', async ({ page }) => {
  test.slow();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: LONG_NAME, activeFrom: BOOKS_OPEN });
  await postEntries(page, [spent(IN_JUNE, `Subscription ${randomUUID()}`, '1234567', added(LONG_NAME))]);

  await page.setViewportSize(PHONE);
  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);

  await expectStatement(page, {
    ...nothingCounted,
    expenses: [['Expenses', '0'], [LONG_NAME, '1,234,567']],
    totalExpense: '1,234,567',
    difference: '-1,234,567',
  });
  for (const table of ['Revenue', 'Expenses', 'Totals'] as const) {
    await expectWithinPhone(page, statementTable(page, table));
  }
});

test('renders the Income statement page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(STATEMENT);

  await expect(periodForm(page)).toBeVisible();
  await expect(statementTable(page, 'Totals')).toBeVisible();
});
