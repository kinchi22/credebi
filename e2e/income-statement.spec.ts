import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { type AccountType, addAccount, addGroup, BOOKS_OPEN, bottom, type Box, boxOf, dayInBrowser } from './accounts';
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
  type Statement,
  showStatement,
  statementTable,
  type StatementRow,
  type StatementTable,
  statementTables,
} from './income-statement';
import {
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH as STATEMENT,
  INCOME_STATEMENT_WITH_QUERY,
  INCOME_STATEMENT_WITHOUT_QUERY,
  queryOf,
  SIGN_IN_URL,
  UUID_V7,
} from './routes';
import { CATALOGUE, documentLanguage, signUpAfterChoosing } from './language';
import { freshIdentifier, signIn, signInForSmoke, submitTestSignIn } from './session';
import { SIGNED_IN_PAGES, sidebar } from './sidebar';
import { HANGUL } from './typed-text';
import { expectWithinPhone, PHONE, WIDE_BELOW_SPLIT } from './viewport';

const TODAY = '2026-09-15';

const JUNE_FIRST = '2026-06-01';

const JUNE_LAST = '2026-06-30';

const IN_JUNE = '2026-06-15';

const REVERSED_JUNE = `${STATEMENT}?from=${JUNE_LAST}&to=${JUNE_FIRST}`;

const SIDEBAR_LINKS = ['Entries', 'Entry search', 'Income statement', 'Settings'] as const;

const WIDE = { width: 1280, height: 720 } as const;

const MIDDLE_DOT = '\u00B7';

const LONG_NAME = 'Memberships paid for every single month';

const entryOn = (
  day: string,
  memo: string,
  debitAccount: LineAccount,
  creditAccount: LineAccount,
  amount: string,
): TwoLineEntry => ({ day, memo, debitAccount, creditAccount, amount });

const spent = (day: string, memo: string, amount: string, account: LineAccount = 'Expenses'): TwoLineEntry =>
  entryOn(day, memo, account, 'Cash', amount);

const earned = (day: string, memo: string, amount: string, account: LineAccount = 'Sales'): TwoLineEntry =>
  entryOn(day, memo, 'Cash', account, amount);

const statementLinkIn = (navigation: Locator): Locator => navigation.locator(`a[href="${STATEMENT}"]`);

const statementLink = (page: Page): Locator => statementLinkIn(sidebar(page));

const koreanStatementLink = (page: Page): Locator =>
  statementLinkIn(page.getByRole('navigation', { name: HANGUL }));

const added = (name: string): LineAccount => ({ added: name });

const nothingCounted = {
  revenue: [['Sales', '0']],
  totalRevenue: '0',
  expenses: [['Expenses', '0']],
  totalExpense: '0',
  netIncome: '0',
} as const;

const spentOnly = (amount: string): Statement => ({
  ...nothingCounted,
  expenses: [['Expenses', amount]],
  totalExpense: amount,
  netIncome: `-${amount}`,
});

const rangeInUrl = (page: Page): Record<string, string> => Object.fromEntries(queryOf(page));

type SectionTable = Exclude<StatementTable, 'Totals'>;

const OTHER_SECTION: Record<SectionTable, SectionTable> = { Expenses: 'Revenue', Revenue: 'Expenses' };

const THREE_EXPENSES = ['Rent', 'Travel', 'Utilities'] as const;

const zeroRows = (first: string, names: readonly string[]): StatementRow[] =>
  [first, ...names].map((name) => [name, '0'] as const);

async function addAccounts(page: Page, type: AccountType, names: readonly string[]): Promise<void> {
  for (const name of names) {
    await addAccount(page, type, { name, activeFrom: BOOKS_OPEN });
  }
}

async function showJuneAt1280(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
}

async function boxesOf(page: Page): Promise<Record<StatementTable, Box>> {
  await expect(statementTables(page)).toHaveCount(3);
  return {
    Revenue: await boxOf(statementTable(page, 'Revenue'), 'the Revenue table'),
    Expenses: await boxOf(statementTable(page, 'Expenses'), 'the Expenses table'),
    Totals: await boxOf(statementTable(page, 'Totals'), 'the Totals table'),
  };
}

async function expectTwoColumnsWithTotalsUnder(page: Page, section: SectionTable): Promise<Record<StatementTable, Box>> {
  const boxes = await boxesOf(page);
  const { Expenses: expenses, Revenue: revenue, Totals: totals } = boxes;
  const under = boxes[section];
  expect(expenses.x + expenses.width).toBeLessThanOrEqual(revenue.x);
  expect(revenue.y).toBeCloseTo(expenses.y, 0);
  expect(totals.x).toBeCloseTo(under.x, 0);
  expect(totals.x + totals.width).toBeCloseTo(under.x + under.width, 0);
  expect(totals.y).toBeGreaterThanOrEqual(bottom(under));
  return boxes;
}

async function expectTotalsDirectlyBelowShorter(page: Page, shorter: SectionTable): Promise<void> {
  const boxes = await expectTwoColumnsWithTotalsUnder(page, shorter);
  expect(boxes.Totals.y).toBeLessThan(bottom(boxes[OTHER_SECTION[shorter]]));
}

async function expectOneColumn(page: Page): Promise<void> {
  const { Revenue: revenue, Expenses: expenses, Totals: totals } = await boxesOf(page);
  expect(expenses.x).toBeCloseTo(revenue.x, 0);
  expect(totals.x).toBeCloseTo(revenue.x, 0);
  expect(expenses.y).toBeGreaterThanOrEqual(bottom(revenue));
  expect(totals.y).toBeGreaterThanOrEqual(bottom(expenses));
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
  await expectStatement(page, spentOnly('6,000'));
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);

  await fixToday(page, '2028-02-10');
  await page.goto(STATEMENT);

  await expectPeriod(page, '2028-02-01', '2028-02-29');
  await expectStatement(page, spentOnly('16,000'));
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);
});

test('puts a range chosen with From and To into the URL, which a reload and the back button keep', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    spent(IN_JUNE, `June ${run}`, '1000'),
    spent('2026-07-15', `July ${run}`, '2000'),
  ]);
  const june = spentOnly('1,000');
  const july = spentOnly('2,000');

  await fixToday(page, TODAY);
  await page.goto(STATEMENT);
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);

  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expect(page).toHaveURL(INCOME_STATEMENT_WITH_QUERY);
  expect(rangeInUrl(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectStatement(page, june);

  await showStatement(page, '2026-07-01', '2026-07-31');
  expect(rangeInUrl(page)).toMatchObject({ from: '2026-07-01', to: '2026-07-31' });
  await expectStatement(page, july);

  await page.goBack();
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, june);

  await page.reload();
  expect(rangeInUrl(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, june);
});

test('fills From and To from a date preset and shows the statement for it, with the range in the URL', async ({ page }) => {
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
  expect(rangeInUrl(page)).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  await expectStatement(page, spentOnly('1,000'));

  await choosePreset(page, 'Year', '2025');
  await expectPeriod(page, '2025-01-01', '2025-12-31');
  expect(rangeInUrl(page)).toMatchObject({ from: '2025-01-01', to: '2025-12-31' });
  await expectStatement(page, spentOnly('2,000'));
});

test('refuses a range whose From is later than its To, explains itself, and shows no statement', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(STATEMENT);

  await showStatement(page, JUNE_LAST, JUNE_FIRST);

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/range/i);
  await expect(statementTables(page)).toHaveCount(0);
});

test('refuses a reversed range opened from the URL, explains itself, and shows no statement', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });

  await page.goto(REVERSED_JUNE);

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/range/i);
  await expect(periodForm(page)).toBeVisible();
  await expect(statementTables(page)).toHaveCount(0);
});

test('links to the Income statement from the Sidebar of every signed-in page, after Entry search and before Settings', async ({ page }) => {
  await signIn(page);

  for (const path of [...SIGNED_IN_PAGES, STATEMENT]) {
    await page.goto(path);
    await expect(sidebar(page).getByRole('link')).toHaveText([...SIDEBAR_LINKS]);
  }

  await page.goto('/entries');
  await statementLink(page).click();
  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);
  await expect(periodForm(page)).toBeVisible();
  await expect(statementLink(page)).toHaveAttribute('aria-current', 'page');
});

test('links to the Income statement from the drawer behind Menu at 390px', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await statementLink(page).click();

  await expect(page).toHaveURL(INCOME_STATEMENT_WITHOUT_QUERY);
  await expect(periodForm(page)).toBeVisible();
});

test('names the Income statement by exactly one level-1 heading on a wide window and at 390px, and titles it before Credebi', async ({ page }) => {
  await signIn(page);

  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto(STATEMENT);
    await expect(page.getByRole('heading', { level: 1, name: 'Income statement', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  }
  await expect(page).toHaveTitle(`Income statement ${MIDDLE_DOT} Credebi`);
});

test("shows the Income statement in the User's Language: its heading, title, tables, Sidebar link, Accounts and refusal", async ({ page }) => {
  await signUpAfterChoosing(page, 'ko');
  await page.goto(STATEMENT);

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(HANGUL);
  await expect(heading).not.toHaveText('Income statement');
  await expect(page).toHaveTitle(new RegExp(`\\p{Script=Hangul}.* ${MIDDLE_DOT} Credebi$`, 'u'));
  await expect(koreanStatementLink(page)).toHaveText(HANGUL);

  const tables = statementTables(page);
  await expect(tables).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(tables.nth(index)).toHaveAccessibleName(HANGUL);
  }
  const [, , , sales, expenses] = CATALOGUE.ko.startingAccounts;
  for (const name of [sales ?? '', expenses ?? '']) {
    await expect(page.getByRole('main').getByRole('link', { name, exact: true })).toBeVisible();
  }

  await page.goto(REVERSED_JUNE);
  const refusal = page.getByRole('main').getByRole('alert');
  await expect(refusal).toHaveText(HANGUL);
  await expect(refusal).not.toContainText(/range/i);
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
    entryOn(IN_JUNE, `Sale returned ${run}`, 'Sales', 'Cash', '3000'),
    spent(IN_JUNE, `Supplies ${run}`, '4000'),
    entryOn(IN_JUNE, `Supplies refunded ${run}`, 'Cash', 'Expenses', '1000'),
    entryOn(IN_JUNE, `Fare refunded ${run}`, 'Cash', travel, '5000'),
  ]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);

  await expectStatement(page, {
    revenue: [['Sales', '9,500']],
    totalRevenue: '9,500',
    expenses: [['Expenses', '3,000'], ['Travel', '-5,000']],
    totalExpense: '-2,000',
    netIncome: '11,500',
  });
});

test('counts an Entry by its calendar day, not the day it was written', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [spent(IN_JUNE, `Backdated ${randomUUID()}`, '7000')]);

  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, spentOnly('7,000'));

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

  const counted = spentOnly('4,000');
  await page.goto(STATEMENT);
  await showStatement(page, JUNE_FIRST, JUNE_LAST);
  await expectStatement(page, counted);

  await showStatement(page, EARLIEST, LATEST);
  await expectStatement(page, counted);
});

test('lists each revenue and expense Account whose Active period overlaps the range, at zero when no Entry names it, and leaves out one active only outside it', async ({ page }) => {
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
    netIncome: '0',
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
    netIncome: '4,000',
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
  const query = rangeInUrl(page);
  expect(query).toMatchObject({ from: JUNE_FIRST, to: JUNE_LAST });
  expect(query['account'] ?? '').toMatch(UUID_V7);
  await expect(accountField(page)).toHaveValue('Groceries');
  await expect(fromField(page)).toHaveValue(JUNE_FIRST);
  await expect(toField(page)).toHaveValue(JUNE_LAST);
  await expect(resultFor(page, market)).toHaveCount(1);
  await expect(resultFor(page, stationery)).toHaveCount(0);
  await expect(resultFor(page, july)).toHaveCount(0);
});

test("counts no other User's Entries, and shows both sections and their totals at zero when nothing counts", async ({ browser }) => {
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
    netIncome: '-1,234,567',
  });
  for (const table of ['Revenue', 'Expenses', 'Totals'] as const) {
    await expectWithinPhone(page, statementTable(page, table));
  }
});

test('puts Expenses left of Revenue at 1280px, their tops level, and Totals directly below Expenses when Expenses has fewer rows', async ({ page }) => {
  const revenue = ['Interest', 'Royalties', 'Tips'] as const;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccounts(page, 'Revenue', revenue);

  await showJuneAt1280(page);

  await expectStatement(page, { ...nothingCounted, revenue: zeroRows('Sales', revenue) });
  await expectTotalsDirectlyBelowShorter(page, 'Expenses');
});

test('puts Expenses left of Revenue at 1280px, their tops level, and Totals directly below Revenue when Revenue has fewer rows', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccounts(page, 'Expenses', THREE_EXPENSES);

  await showJuneAt1280(page);

  await expectStatement(page, { ...nothingCounted, expenses: zeroRows('Expenses', THREE_EXPENSES) });
  await expectTotalsDirectlyBelowShorter(page, 'Revenue');
});

test("counts each Account group's row as a row at 1280px, so Totals goes directly below Expenses when only the group rows make Revenue longer", async ({ page }) => {
  test.slow();
  const groups = [
    ['Salary', 'Base pay'],
    ['Bonus', 'Year-end bonus'],
    ['Gifts', 'Birthday gifts'],
  ] as const;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  for (const [group, name] of groups) {
    await addGroup(page, 'Revenue', { name: group });
    await addAccount(page, 'Revenue', { name, group, activeFrom: BOOKS_OPEN });
  }
  await addAccounts(page, 'Expenses', THREE_EXPENSES);

  await showJuneAt1280(page);

  await expectStatement(page, {
    ...nothingCounted,
    revenue: zeroRows('Sales', groups.flat()),
    expenses: zeroRows('Expenses', THREE_EXPENSES),
  });
  await expectTotalsDirectlyBelowShorter(page, 'Expenses');
});

test('puts Expenses left of Revenue at 1280px, their tops level, and Totals below Revenue when the two have the same number of rows', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });

  await showJuneAt1280(page);

  await expectStatement(page, nothingCounted);
  await expectTwoColumnsWithTotalsUnder(page, 'Revenue');
});

test('stacks Revenue, Expenses and Totals in one column below 1280px and at 390px', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Revenue', { name: 'Interest', activeFrom: BOOKS_OPEN });

  for (const viewport of [WIDE_BELOW_SPLIT, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto(STATEMENT);
    await showStatement(page, JUNE_FIRST, JUNE_LAST);

    await expectStatement(page, { ...nothingCounted, revenue: [['Sales', '0'], ['Interest', '0']] });
    await expectOneColumn(page);
  }
});

test('renders the Income statement page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(STATEMENT);

  await expect(periodForm(page)).toBeVisible();
  await expect(statementTable(page, 'Totals')).toBeVisible();
});
