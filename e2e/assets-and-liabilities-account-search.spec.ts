import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN } from './accounts';
import { reportTable } from './assets-and-liabilities';
import { added, entryOn, intoCash, postEntries } from './entries';
import { accountField, fromField, resultFor, toField } from './entry-search';
import { tabTo } from './language';
import { accountLink, expectGroupControls, groupControl, reportRow } from './report-tables';
import {
  ASSETS_AND_LIABILITIES_PATH as REPORT,
  ENTRY_SEARCH_PATH,
  queryOf,
  SETTINGS_PATH,
  UUID_V7,
} from './routes';
import { signIn } from './session';

const REPORT_DAY = '2026-06-30';

const LONG_BEFORE = '2026-01-10';

const IN_JUNE = '2026-06-15';

const IN_JULY = '2026-07-15';

type Coloured = {
  readonly ownerDocument: {
    readonly defaultView: { getComputedStyle: (element: Coloured) => { readonly color: string } } | null;
  };
};

type Memos = Readonly<
  Record<
    'savingsEarlier' | 'savingsBefore' | 'savingsOnDay' | 'savingsAfter' | 'mortgageBefore' | 'mortgageAfter' | 'elsewhere',
    string
  >
>;

async function signInWithSavingsAndMortgage(page: Page): Promise<Memos> {
  const run = randomUUID();
  const memos: Memos = {
    savingsEarlier: `Savings earlier ${run}`,
    savingsBefore: `Savings before ${run}`,
    savingsOnDay: `Savings on the day ${run}`,
    savingsAfter: `Savings after ${run}`,
    mortgageBefore: `Mortgage before ${run}`,
    mortgageAfter: `Mortgage after ${run}`,
    elsewhere: `Elsewhere ${run}`,
  };
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Assets', { name: 'Savings', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Liabilities', { name: 'Loans' });
  await addAccount(page, 'Liabilities', { name: 'Mortgage', group: 'Loans', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    entryOn(LONG_BEFORE, memos.savingsEarlier, added('Savings'), 'Cash', '300'),
    entryOn(IN_JUNE, memos.savingsBefore, added('Savings'), 'Cash', '500'),
    entryOn(REPORT_DAY, memos.savingsOnDay, added('Savings'), 'Cash', '600'),
    entryOn(IN_JULY, memos.savingsAfter, added('Savings'), 'Cash', '700'),
    entryOn(IN_JUNE, memos.mortgageBefore, 'Cash', added('Mortgage'), '1000'),
    entryOn(IN_JULY, memos.mortgageAfter, 'Cash', added('Mortgage'), '2000'),
    intoCash(IN_JUNE, memos.elsewhere, '4000'),
  ]);
  await page.goto(`${REPORT}?date=${REPORT_DAY}`);
  return memos;
}

async function expectSearchThroughReportDay(page: Page, account: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === ENTRY_SEARCH_PATH);
  const query = queryOf(page);
  expect(query.get('to')).toBe(REPORT_DAY);
  expect(query.has('from')).toBe(false);
  expect(query.get('account') ?? '').toMatch(UUID_V7);
  await expect(accountField(page)).toHaveValue(account);
  await expect(toField(page)).toHaveValue(REPORT_DAY);
  await expect(fromField(page)).toHaveValue('');
}

test('links an asset Account under its Account type to Entry search ending on the report day with no start day, listing its earlier Entries and no later or other Entries', async ({ page }) => {
  test.slow();
  const memos = await signInWithSavingsAndMortgage(page);

  await accountLink(page, 'Assets', 'Savings').click();

  await expectSearchThroughReportDay(page, 'Savings');
  await expect(resultFor(page, memos.savingsEarlier)).toHaveCount(1);
  await expect(resultFor(page, memos.savingsBefore)).toHaveCount(1);
  await expect(resultFor(page, memos.savingsOnDay)).toHaveCount(1);
  await expect(resultFor(page, memos.savingsAfter)).toHaveCount(0);
  await expect(resultFor(page, memos.mortgageBefore)).toHaveCount(0);
  await expect(resultFor(page, memos.elsewhere)).toHaveCount(0);
});

test('links a liability Account inside an Account group to Entry search ending on the report day with no start day, listing its earlier Entries and no later or other Entries', async ({ page }) => {
  test.slow();
  const memos = await signInWithSavingsAndMortgage(page);

  await accountLink(page, 'Liabilities', 'Mortgage').click();

  await expectSearchThroughReportDay(page, 'Mortgage');
  await expect(resultFor(page, memos.mortgageBefore)).toHaveCount(1);
  await expect(resultFor(page, memos.mortgageAfter)).toHaveCount(0);
  await expect(resultFor(page, memos.savingsBefore)).toHaveCount(0);
  await expect(resultFor(page, memos.elsewhere)).toHaveCount(0);
});

test('makes every Account row a link, a zero-balance Account included, and neither a total, Net worth nor an Account group heading a link', async ({ page }) => {
  test.slow();
  await signInWithSavingsAndMortgage(page);
  const assets = reportTable(page, 'Assets');
  const liabilities = reportTable(page, 'Liabilities');

  await expect(assets.getByRole('link')).toHaveText(['Cash', 'Bank deposits', 'Savings']);
  await expect(liabilities.getByRole('link')).toHaveText(['Credit card payable', 'Mortgage']);
  await expect(reportRow(assets, 'Bank deposits').getByRole('link')).toHaveCount(1);
  await expect(reportRow(liabilities, 'Credit card payable').getByRole('link')).toHaveCount(1);
  await expect(reportRow(assets, 'Total assets').getByRole('link')).toHaveCount(0);
  await expect(reportRow(liabilities, 'Total liabilities').getByRole('link')).toHaveCount(0);
  await expect(reportRow(assets, 'Cash and deposits').getByRole('link')).toHaveCount(0);
  await expect(reportRow(liabilities, 'Loans').getByRole('link')).toHaveCount(0);
  await expect(reportTable(page, 'Totals').getByRole('link')).toHaveCount(0);
});

test('keeps an Account group heading a collapse control that hides and shows its Accounts and their links', async ({ page }) => {
  test.slow();
  await signInWithSavingsAndMortgage(page);
  const liabilities = reportTable(page, 'Liabilities');
  const loans = groupControl(liabilities, 'Loans');
  await expect(accountLink(page, 'Liabilities', 'Mortgage')).toBeVisible();

  await loans.click();

  await expectGroupControls(liabilities, { Loans: false });
  await expect(accountLink(page, 'Liabilities', 'Mortgage')).toHaveCount(0);
  await expect(reportRow(liabilities, 'Mortgage')).toHaveCount(0);
  await expect(page).toHaveURL(`${REPORT}?date=${REPORT_DAY}`);

  await loans.click();

  await expectGroupControls(liabilities, { Loans: true });
  await expect(accountLink(page, 'Liabilities', 'Mortgage')).toBeVisible();
  await expect(reportRow(liabilities, 'Mortgage')).toBeVisible();
});

test('reaches an Account link by Tab, shows a visible focus indicator on it and opens its Entry search on Enter', async ({ page }) => {
  test.slow();
  await signInWithSavingsAndMortgage(page);
  const link = accountLink(page, 'Assets', 'Savings');

  await tabTo(page, link);

  await expect(link.and(page.locator(':focus-visible'))).toBeVisible();
  await expect(link).not.toHaveCSS('outline-style', 'none');
  await expect(link).not.toHaveCSS('outline-width', '0px');

  await page.keyboard.press('Enter');

  await expectSearchThroughReportDay(page, 'Savings');
});

test('shows an Account link at rest in the colour of its row heading with no underline', async ({ page }) => {
  test.slow();
  await signInWithSavingsAndMortgage(page);

  for (const [table, name] of [['Assets', 'Savings'], ['Liabilities', 'Mortgage']] as const) {
    const link = accountLink(page, table, name);
    const heading = reportRow(reportTable(page, table), name).getByRole('rowheader');
    const colour = await heading.evaluate((each: Coloured) => each.ownerDocument.defaultView?.getComputedStyle(each).color ?? '');
    await expect(link).toHaveCSS('color', colour);
    await expect(link).toHaveCSS('text-decoration-line', 'none');
  }
});

test('links an Account no Entry names to its Entry search', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(`${REPORT}?date=${REPORT_DAY}`);
  const link = accountLink(page, 'Assets', 'Bank deposits');

  await expect(link).toBeVisible();
  await link.click();

  await expectSearchThroughReportDay(page, 'Bank deposits');
});
