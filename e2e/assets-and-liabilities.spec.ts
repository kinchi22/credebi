import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page, type ViewportSize } from '@playwright/test';
import {
  accountType,
  addAccount,
  addAccounts,
  addGroup,
  BOOKS_OPEN,
  dayInBrowser,
  drag,
  editAccount,
  expectOrder,
  grip,
} from './accounts';
import {
  expectReport,
  type Report,
  reportDate,
  reportDateForm,
  reportPanels,
  reportTable,
  showReport,
} from './assets-and-liabilities';
import { fixToday } from './date-presets';
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
import { INITIAL_CHART, namesOf } from './initial-chart';
import { documentLanguage, pageTitle, signUpAfterChoosing } from './language';
import {
  expectOneColumn,
  expectTotalsDirectlyBelowShorter,
  expectTwoColumnsWithTotalsUnder,
  reportTables,
  type ReportRow,
  atZero,
  zeroRows,
} from './report-tables';
import {
  abortServerActions,
  ASSETS_AND_LIABILITIES_PATH as REPORT,
  ASSETS_AND_LIABILITIES_WITHOUT_QUERY,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  SIGN_IN_URL,
  withQuery,
} from './routes';
import { freshIdentifier, signIn, signInForSmoke, submitTestSignIn } from './session';
import { linkTo, SIGNED_IN_PAGES, menu, sidebar } from './sidebar';
import { HANGUL } from './typed-text';
import { expectWithinPhone, PHONE, WIDE, WIDE_BELOW_SPLIT } from './viewport';

const TODAY = '2026-09-15';

const IN_JUNE = '2026-06-15';

const JUNE_LAST = '2026-06-30';

const JULY_LAST = '2026-07-31';

const AHEAD_OF_THE_SERVER = 'Pacific/Kiritimati';

const KOREAN_PAGE_NAME = '\uC790\uC0B0\u00B7\uBD80\uCC44';

const KOREAN_NET_WORTH = '\uC21C\uC790\uC0B0';

const JAPANESE_PAGE_NAME = '\u8CC7\u7523\u30FB\u8CA0\u50B5';

const JAPANESE_NET_WORTH = '\u7D14\u8CC7\u7523';

const EQUITY_LABEL = { ko: '\uC790\uBCF8', ja: '\u8CC7\u672C' } as const;

const NET_WORTH_LABEL = { ko: KOREAN_NET_WORTH, ja: JAPANESE_NET_WORTH } as const;

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const LONG_NAME = 'Savings kept for every single rainy day';

const THREE_ACCOUNTS = ['First', 'Second', 'Third'] as const;

const FIVE_ACCOUNTS = [...THREE_ACCOUNTS, 'Fourth', 'Fifth'] as const;

const intoCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Cash', 'Opening balance equity', amount);

const outOfCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Food', 'Cash', amount);

const reportLinkIn = (navigation: Locator): Locator => linkTo(navigation, REPORT);

const reportLink = (page: Page): Locator => reportLinkIn(sidebar(page));

const dated = (day: string): string => `${REPORT}?date=${day}`;

const cashAndDeposits = (cash: string): readonly ReportRow[] => [
  ['Cash and deposits', cash],
  ['Cash', cash],
  ['Bank deposits', '0'],
];

const nothingCounted: Report = {
  assets: cashAndDeposits('0'),
  totalAssets: '0',
  liabilities: [['Credit card payable', '0']],
  totalLiabilities: '0',
  netWorth: '0',
};

const cashOnly = (amount: string): Report => ({
  ...nothingCounted,
  assets: cashAndDeposits(amount),
  totalAssets: amount,
  netWorth: amount,
});

async function showJuneLastAt(page: Page, viewport: ViewportSize): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(REPORT);
  await showReport(page, JUNE_LAST);
}

async function expectRefused(page: Page): Promise<void> {
  await expect(reportDateForm(page)).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/date/i);
  await expect(reportTables(page)).toHaveCount(0);
}

test("opens with no date on the browser's calendar day, ahead of the server's, filled into Date with the URL unchanged, and counts Entries through that day", async ({ browser }) => {
  test.slow();
  const run = randomUUID();
  const context = await browser.newContext({ timezoneId: AHEAD_OF_THE_SERVER });
  const page = await context.newPage();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2026-09-14', `Day before ${run}`, '1000'),
    intoCash('2026-09-15', `Same day ${run}`, '2000'),
    intoCash('2026-09-16', `Day after ${run}`, '4000'),
  ]);

  await page.clock.setFixedTime(new Date('2026-09-14T12:00:00Z'));
  await page.goto(REPORT);

  await expect(reportDateForm(page)).toBeVisible();
  await expect(reportDate(page)).toHaveValue('2026-09-15');
  await expectReport(page, cashOnly('3,000'));
  await expect(page).toHaveURL(ASSETS_AND_LIABILITIES_WITHOUT_QUERY);

  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'));
  await page.goto(REPORT);

  await expect(reportDate(page)).toHaveValue('2026-09-16');
  await expectReport(page, cashOnly('7,000'));
  await expect(page).toHaveURL(ASSETS_AND_LIABILITIES_WITHOUT_QUERY);

  await context.close();
});

test('puts a day chosen with Date and Show into the URL, which a reload and the back button keep', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `June ${run}`, '1000'), intoCash('2026-07-15', `July ${run}`, '2000')]);
  const june = cashOnly('1,000');
  const july = cashOnly('3,000');

  await fixToday(page, TODAY);
  await page.goto(REPORT);
  await expect(page).toHaveURL(ASSETS_AND_LIABILITIES_WITHOUT_QUERY);

  await showReport(page, JUNE_LAST);
  await expect(page).toHaveURL(withQuery(REPORT, { date: JUNE_LAST }));
  await expectReport(page, june);

  await showReport(page, JULY_LAST);
  await expect(page).toHaveURL(withQuery(REPORT, { date: JULY_LAST }));
  await expectReport(page, july);

  await page.goBack();
  await expect(page).toHaveURL(withQuery(REPORT, { date: JUNE_LAST }));
  await expect(reportDate(page)).toHaveValue(JUNE_LAST);
  await expectReport(page, june);

  await page.reload();
  await expect(page).toHaveURL(withQuery(REPORT, { date: JUNE_LAST }));
  await expect(reportDate(page)).toHaveValue(JUNE_LAST);
  await expectReport(page, june);
});

test('shows a future day opened from the URL, counting the Entries already recorded through it and none after it', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Now ${run}`, '1000'), intoCash('2030-01-15', `Future ${run}`, '5000')]);
  await fixToday(page, TODAY);

  await page.goto(dated('2030-01-14'));
  await expect(reportDate(page)).toHaveValue('2030-01-14');
  await expectReport(page, cashOnly('1,000'));

  await page.goto(dated('2030-01-15'));
  await expect(reportDate(page)).toHaveValue('2030-01-15');
  await expectReport(page, cashOnly('6,000'));
});

test("shows an error and no report when the browser's read of today fails, and shows the report once Show is pressed again", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await fixToday(page, TODAY);
  await abortServerActions(page, REPORT);

  await page.goto(REPORT);

  await expect(reportDate(page)).toHaveValue(TODAY);
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(reportTables(page)).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
  await reportDateForm(page).getByRole('button', { name: 'Show', exact: true }).click();

  await expect(page).toHaveURL(withQuery(REPORT, { date: TODAY }));
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expectReport(page, cashOnly('1,000'));
});

test('refuses an empty, impossible, malformed or repeated date in the URL, explains itself, and shows no report', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(dated(JUNE_LAST));
  await expectReport(page, nothingCounted);

  for (const query of ['date=', 'date=2026-02-30', 'date=30-06-2026', `date=${JUNE_LAST}&date=${JULY_LAST}`]) {
    await page.goto(`${REPORT}?${query}`);
    await expectRefused(page);
  }
});

test("accumulates each balance from the start of the books through the selected day, inclusive, rather than showing that day's movement", async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2026-06-10', `Paid in ${run}`, '10000'),
    outOfCash('2026-06-20', `Spent ${run}`, '3000'),
  ]);

  await page.goto(REPORT);
  for (const [day, cash] of [
    ['2026-06-09', '0'],
    ['2026-06-10', '10,000'],
    ['2026-06-19', '10,000'],
    ['2026-06-20', '7,000'],
    [JULY_LAST, '7,000'],
  ] as const) {
    await showReport(page, day);
    await expectReport(page, cashOnly(cash));
  }
});

test('counts an Entry by its calendar day, not the day it was written', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Backdated ${randomUUID()}`, '7000')]);

  await page.goto(REPORT);
  await showReport(page, '2026-06-14');
  await expectReport(page, nothingCounted);

  await showReport(page, IN_JUNE);
  await expectReport(page, cashOnly('7,000'));

  await showReport(page, await dayInBrowser(page));
  await expectReport(page, cashOnly('7,000'));
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
    entryOn(IN_JUNE, `Overdrawn ${run}`, 'Food', bank, '2500'),
    entryOn(IN_JUNE, `Charged ${run}`, 'Food', card, '9000'),
    entryOn(IN_JUNE, `Card repaid ${run}`, card, 'Cash', '500'),
    entryOn(IN_JUNE, `Card overpaid ${run}`, 'Credit card payable', 'Opening balance equity', '1200'),
  ]);

  await page.goto(dated(JUNE_LAST));

  await expectReport(page, {
    assets: [...cashAndDeposits('3,500'), ['Overdrawn bank', '-2,500']],
    totalAssets: '1,000',
    liabilities: [['Credit card payable', '-1,200'], ['Card', '8,500']],
    totalLiabilities: '7,300',
    netWorth: '-6,300',
  });
});

test('lists an Account on the first and last days of its Active period, at zero with no Entry, and leaves it out the day before it starts and the day after it ends', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Wallet', activeFrom: '2026-06-10', activeUntil: '2026-06-20' });
  await addAccount(page, 'Liabilities', { name: 'Tab', activeFrom: '2026-06-10', activeUntil: '2026-06-20' });
  const listed: Report = {
    ...nothingCounted,
    assets: [...cashAndDeposits('0'), ['Wallet', '0']],
    liabilities: [['Credit card payable', '0'], ['Tab', '0']],
  };

  await page.goto(REPORT);
  for (const [day, report] of [
    ['2026-06-09', nothingCounted],
    ['2026-06-10', listed],
    ['2026-06-20', listed],
    ['2026-06-21', nothingCounted],
  ] as const) {
    await showReport(page, day);
    await expectReport(page, report);
  }
});

test('leaves an ended Account with a balance out of its row, its group subtotal, total assets, total liabilities and Net worth together', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addGroup(page, 'Assets', { name: 'Savings' });
  await addAccount(page, 'Assets', { name: 'Deposit', group: 'Savings', activeFrom: BOOKS_OPEN, activeUntil: JUNE_LAST });
  await addAccount(page, 'Assets', { name: 'Fund', group: 'Savings', activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Liabilities', { name: 'Old loan', activeFrom: BOOKS_OPEN, activeUntil: JUNE_LAST });
  await postEntries(page, [
    entryOn(IN_JUNE, `Deposited ${run}`, added('Deposit'), 'Opening balance equity', '4000'),
    entryOn(IN_JUNE, `Invested ${run}`, added('Fund'), 'Opening balance equity', '1000'),
    entryOn(IN_JUNE, `Borrowed ${run}`, 'Food', added('Old loan'), '3000'),
  ]);

  await page.goto(dated(JUNE_LAST));
  await expectReport(page, {
    assets: [...cashAndDeposits('0'), ['Savings', '5,000'], ['Deposit', '4,000'], ['Fund', '1,000']],
    totalAssets: '5,000',
    liabilities: [['Credit card payable', '0'], ['Old loan', '3,000']],
    totalLiabilities: '3,000',
    netWorth: '2,000',
  });

  await page.goto(dated('2026-07-01'));
  await expectReport(page, {
    assets: [...cashAndDeposits('0'), ['Savings', '1,000'], ['Fund', '1,000']],
    totalAssets: '1,000',
    liabilities: [['Credit card payable', '0']],
    totalLiabilities: '0',
    netWorth: '1,000',
  });
});

test('shows both sections, their totals and Net worth at zero on a day no Account is active', async ({ page }) => {
  await signIn(page, { accountsStartOn: '2026-06-01' });
  await page.goto(dated('2026-06-01'));
  await expectReport(page, nothingCounted);

  await page.goto(dated('2026-05-31'));

  await expectReport(page, {
    assets: [],
    totalAssets: '0',
    liabilities: [],
    totalLiabilities: '0',
    netWorth: '0',
  });
});

test("puts each Account under its Account group with the group's subtotal, in Chart of accounts order, counts each Account once in the totals, and leaves out empty groups and equity, revenue and expense Accounts", async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addGroup(page, 'Assets', { name: 'Banks' });
  await addAccount(page, 'Assets', { name: 'Checking', group: 'Banks', activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Assets', { name: 'Savings account', group: 'Banks', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Assets', { name: 'Empty' });
  await addGroup(page, 'Assets', { name: 'Retired' });
  await addAccount(page, 'Assets', {
    name: 'Old card',
    group: 'Retired',
    activeFrom: '2026-01-01',
    activeUntil: '2026-05-31',
  });
  await addAccount(page, 'Assets', { name: 'Wallet', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Liabilities', { name: 'Loans' });
  await addAccount(page, 'Liabilities', { name: 'Mortgage', group: 'Loans', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    entryOn(IN_JUNE, `Checking ${run}`, added('Checking'), 'Opening balance equity', '2000'),
    entryOn(IN_JUNE, `Saved ${run}`, added('Savings account'), 'Salary', '3000'),
    entryOn(IN_JUNE, `Mortgaged ${run}`, 'Cash', added('Mortgage'), '10000'),
    outOfCash(IN_JUNE, `Spent ${run}`, '1000'),
  ]);

  await page.goto(dated(JUNE_LAST));

  await expectReport(page, {
    assets: [
      ...cashAndDeposits('9,000'),
      ['Banks', '5,000'],
      ['Checking', '2,000'],
      ['Savings account', '3,000'],
      ['Wallet', '0'],
    ],
    totalAssets: '14,000',
    liabilities: [['Credit card payable', '0'], ['Loans', '10,000'], ['Mortgage', '10,000']],
    totalLiabilities: '10,000',
    netWorth: '4,000',
  });
});

test("shows a past day's balances under each Account's current name and Account group, in the current Chart of accounts order", async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccounts(page, 'Assets', ['Wallet', 'Bank']);
  await postEntries(page, [
    entryOn(IN_JUNE, `Pocketed ${run}`, added('Wallet'), 'Opening balance equity', '2000'),
    entryOn(IN_JUNE, `Banked ${run}`, added('Bank'), 'Opening balance equity', '3000'),
  ]);
  await page.goto(dated(JUNE_LAST));
  await expectReport(page, {
    ...nothingCounted,
    assets: [...cashAndDeposits('0'), ['Wallet', '2,000'], ['Bank', '3,000']],
    totalAssets: '5,000',
    netWorth: '5,000',
  });

  await page.goto(SETTINGS_PATH);
  const assets = accountType(page, 'Assets');
  await editAccount(page, 'Assets', 'Wallet', { name: 'Pocket money' });
  await addGroup(page, 'Assets', { name: 'Banks' });
  await editAccount(page, 'Assets', 'Bank', { group: 'Banks' });
  await drag(page, grip(assets, 'Pocket money'), grip(assets, 'Cash'));
  await expectOrder(assets, ['Cash and deposits', 'Pocket money', 'Cash', 'Bank deposits', 'Banks', 'Bank']);

  await page.goto(dated(JUNE_LAST));

  await expectReport(page, {
    ...nothingCounted,
    assets: [
      ['Cash and deposits', '2,000'],
      ['Pocket money', '2,000'],
      ['Cash', '0'],
      ['Bank deposits', '0'],
      ['Banks', '3,000'],
      ['Bank', '3,000'],
    ],
    totalAssets: '5,000',
    netWorth: '5,000',
  });
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

  await page.goto(dated(JUNE_LAST));

  await expectReport(page, cashOnly('6,000'));
});

test("counts no other User's Accounts or Entries in a User's balances, subtotals or totals", async ({ browser }) => {
  const run = randomUUID();
  const safe = `Private safe ${run.slice(0, 8)}`;
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage, { accountsStartOn: BOOKS_OPEN });
  await ownerPage.goto(SETTINGS_PATH);
  await addAccount(ownerPage, 'Assets', { name: safe, activeFrom: BOOKS_OPEN });
  await postEntries(ownerPage, [
    intoCash(IN_JUNE, `Private cash ${run}`, '1000'),
    entryOn(IN_JUNE, `Private debt ${run}`, 'Food', 'Credit card payable', '2000'),
  ]);
  await ownerPage.goto(dated(JUNE_LAST));
  await expectReport(ownerPage, {
    assets: [...cashAndDeposits('1,000'), [safe, '0']],
    totalAssets: '1,000',
    liabilities: [['Credit card payable', '2,000']],
    totalLiabilities: '2,000',
    netWorth: '-1,000',
  });

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, { accountsStartOn: BOOKS_OPEN });
  await otherPage.goto(dated(JUNE_LAST));

  await expectReport(otherPage, nothingCounted);

  await owner.close();
  await other.close();
});

test('sends a signed-out visitor to sign in, and back to the report for the day they asked for once signed in', async ({ page }) => {
  await page.goto(dated(JUNE_LAST));
  await expect(page).toHaveURL(SIGN_IN_URL);

  await submitTestSignIn(page, freshIdentifier(), BOOKS_OPEN);

  await expect(page).toHaveURL(withQuery(REPORT, { date: JUNE_LAST }));
  await expect(reportDate(page)).toHaveValue(JUNE_LAST);
  await expectReport(page, nothingCounted);
});

test('links to Assets and liabilities from the Sidebar of every signed-in page, after Income statement and before Settings', async ({ page }) => {
  await signIn(page);

  for (const path of [...SIGNED_IN_PAGES, INCOME_STATEMENT_PATH, REPORT]) {
    await page.goto(path);
    const names = (): Promise<string[]> => sidebar(page).getByRole('link').allTextContents();
    await expect.poll(async () => (await names()).slice(0, 4)).toEqual([
      'Entries',
      'Entry search',
      'Income statement',
      'Assets and liabilities',
    ]);
    await expect.poll(async () => (await names()).at(-1)).toBe('Settings');
  }

  await page.goto('/entries');
  await reportLink(page).click();
  await expect(page).toHaveURL(ASSETS_AND_LIABILITIES_WITHOUT_QUERY);
  await expect(reportDateForm(page)).toBeVisible();
  await expect(reportLink(page)).toHaveAttribute('aria-current', 'page');
});

test('links to Assets and liabilities from the drawer behind Menu at 390px', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await menu(page).click();
  await reportLink(page).click();

  await expect(page).toHaveURL(ASSETS_AND_LIABILITIES_WITHOUT_QUERY);
  await expect(reportDateForm(page)).toBeVisible();
});

test('names Assets and liabilities by exactly one level-1 heading on a wide window and at 390px, and titles it before Credebi', async ({ page }) => {
  await signIn(page);

  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto(REPORT);
    await expect(page.getByRole('heading', { level: 1, name: 'Assets and liabilities', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  }
  await expect(page).toHaveTitle(pageTitle('Assets and liabilities'));
});

test("shows Assets and liabilities in the User's Language: its heading, title, Sidebar link, date control, tables, Net worth, Accounts and refusal", async ({ page }) => {
  await signUpAfterChoosing(page, 'ko');
  await page.goto(REPORT);

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(KOREAN_PAGE_NAME);
  await expect(page).toHaveTitle(pageTitle(KOREAN_PAGE_NAME));
  await expect(reportLinkIn(page.getByRole('navigation', { name: HANGUL }))).toHaveText(KOREAN_PAGE_NAME);

  const form = page.getByRole('main').getByRole('form');
  await expect(form).toHaveAccessibleName(HANGUL);
  await expect(form.locator('input[name="date"]')).toHaveAccessibleName(HANGUL);

  const tables = reportTables(page);
  await expect(tables).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(tables.nth(index)).toHaveAccessibleName(HANGUL);
    await expect(tables.nth(index)).not.toHaveAccessibleName(/Assets|Liabilities|Totals/);
  }
  await expect(page.getByRole('main').getByRole('rowheader', { name: KOREAN_NET_WORTH, exact: true })).toBeVisible();
  for (const name of namesOf(INITIAL_CHART.ko, ['Assets', 'Liabilities'])) {
    await expect(page.getByRole('main').getByRole('rowheader', { name, exact: true })).toBeVisible();
  }

  await page.goto(`${REPORT}?date=2026-02-30`);
  const refusal = page.getByRole('main').getByRole('alert');
  await expect(refusal).toHaveText(HANGUL);
  await expect(refusal).not.toContainText(/date/i);
  await expect(reportTables(page)).toHaveCount(0);
});

test("shows Assets and liabilities in Japanese when that is the User's Language: its heading, title, Sidebar link, date control, tables, Net worth and Accounts", async ({ page }) => {
  await signUpAfterChoosing(page, 'ja');
  await page.goto(REPORT);

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(JAPANESE_PAGE_NAME);
  await expect(page).toHaveTitle(pageTitle(JAPANESE_PAGE_NAME));
  await expect(reportLinkIn(page.getByRole('navigation', { name: JAPANESE }))).toHaveText(JAPANESE_PAGE_NAME);

  const form = page.getByRole('main').getByRole('form');
  await expect(form).toHaveAccessibleName(JAPANESE);
  await expect(form.locator('input[name="date"]')).toHaveAccessibleName(JAPANESE);

  const tables = reportTables(page);
  await expect(tables).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(tables.nth(index)).toHaveAccessibleName(JAPANESE);
    await expect(tables.nth(index)).not.toHaveAccessibleName(/Assets|Liabilities|Totals/);
  }
  await expect(page.getByRole('main').getByRole('rowheader', { name: JAPANESE_NET_WORTH, exact: true })).toBeVisible();
  for (const name of namesOf(INITIAL_CHART.ja, ['Assets', 'Liabilities'])) {
    await expect(page.getByRole('main').getByRole('rowheader', { name, exact: true })).toBeVisible();
  }
});

for (const language of ['ko', 'ja'] as const) {
  test(`labels the equity Account type apart from Net worth in the Account picker and at Settings in ${language}`, async ({ page }) => {
    const equity = EQUITY_LABEL[language];
    const netWorth = NET_WORTH_LABEL[language];
    const band = (label: string): RegExp => new RegExp(`^${label}(?:[,\u3001].+)?$`, 'u');
    await signUpAfterChoosing(page, language);

    await page.goto('/entries');
    await expect(page.getByRole('main').getByRole('group', { name: band(equity) })).toHaveCount(2);
    await expect(page.getByRole('main').getByRole('group', { name: band(netWorth) })).toHaveCount(0);

    await page.goto(SETTINGS_PATH);
    await expect(page.getByRole('main').getByRole('group', { name: equity, exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('group', { name: netWorth, exact: true })).toHaveCount(0);
  });
}

test('shows each Account with one whole, grouped amount within the screen at 390px', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: LONG_NAME, activeFrom: BOOKS_OPEN });
  await postEntries(page, [entryOn(IN_JUNE, `Saved up ${randomUUID()}`, added(LONG_NAME), 'Opening balance equity', '1234567')]);

  await showJuneLastAt(page, PHONE);

  await expectReport(page, {
    ...nothingCounted,
    assets: [...cashAndDeposits('0'), [LONG_NAME, '1,234,567']],
    totalAssets: '1,234,567',
    netWorth: '1,234,567',
  });
  for (const table of ['Assets', 'Liabilities', 'Totals'] as const) {
    await expectWithinPhone(page, reportTable(page, table));
  }
});

test('puts Assets left of Liabilities at 1280px, their tops level, and Totals directly below Assets when Assets has fewer rows', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccounts(page, 'Liabilities', FIVE_ACCOUNTS);

  await showJuneLastAt(page, WIDE);

  await expectReport(page, { ...nothingCounted, liabilities: zeroRows('Credit card payable', FIVE_ACCOUNTS) });
  await expectTotalsDirectlyBelowShorter(reportPanels(page), 'left');
});

test('puts Assets left of Liabilities at 1280px, their tops level, and Totals directly below Liabilities when Liabilities has fewer rows', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccounts(page, 'Assets', THREE_ACCOUNTS);

  await showJuneLastAt(page, WIDE);

  await expectReport(page, { ...nothingCounted, assets: [...cashAndDeposits('0'), ...atZero(THREE_ACCOUNTS)] });
  await expectTotalsDirectlyBelowShorter(reportPanels(page), 'right');
});

test("counts each Account group's row as a row at 1280px, so Totals goes directly below Assets when only the group rows make Liabilities longer", async ({ page }) => {
  test.slow();
  const groups = [
    ['Loans', 'Car loan'],
    ['Cards', 'Credit card'],
    ['Family', 'Owed to parents'],
    ['Tax', 'Tax owed'],
  ] as const;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  for (const [group, name] of groups) {
    await addGroup(page, 'Liabilities', { name: group });
    await addAccount(page, 'Liabilities', { name, group, activeFrom: BOOKS_OPEN });
  }
  await addAccounts(page, 'Assets', THREE_ACCOUNTS);

  await showJuneLastAt(page, WIDE);

  await expectReport(page, {
    ...nothingCounted,
    assets: [...cashAndDeposits('0'), ...atZero(THREE_ACCOUNTS)],
    liabilities: zeroRows('Credit card payable', groups.flat()),
  });
  await expectTotalsDirectlyBelowShorter(reportPanels(page), 'left');
});

test('puts Assets left of Liabilities at 1280px, their tops level, and Totals below Liabilities when the two have the same number of rows', async ({ page }) => {
  const twoMore = THREE_ACCOUNTS.slice(0, 2);
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccounts(page, 'Liabilities', twoMore);

  await showJuneLastAt(page, WIDE);

  await expectReport(page, { ...nothingCounted, liabilities: zeroRows('Credit card payable', twoMore) });
  await expectTwoColumnsWithTotalsUnder(reportPanels(page), 'right');
});

test('stacks Assets, Liabilities and Totals in one column below 1280px and at 390px', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Wallet', activeFrom: BOOKS_OPEN });

  for (const viewport of [WIDE_BELOW_SPLIT, PHONE]) {
    await showJuneLastAt(page, viewport);

    await expectReport(page, { ...nothingCounted, assets: [...cashAndDeposits('0'), ['Wallet', '0']] });
    await expectOneColumn(reportTable(page, 'Assets'), reportTable(page, 'Liabilities'), reportTable(page, 'Totals'));
  }
});

test('renders the Assets and liabilities page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(REPORT);

  await expect(reportDateForm(page)).toBeVisible();
  await expect(reportTable(page, 'Totals')).toBeVisible();
});
