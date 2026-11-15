import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN } from './accounts';
import { expectReport, type Report, reportTable } from './assets-and-liabilities';
import { added, entryOn, intoCash, postEntries } from './entries';
import { statementTable } from './income-statement';
import { tabTo } from './language';
import {
  expectGroupControls,
  expectLabels,
  groupControl,
  reloadUntilExpanded,
  type ReportRow,
} from './report-tables';
import {
  abortServerActions,
  ASSETS_AND_LIABILITIES_PATH as REPORT,
  failedServerAction,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  withQuery,
} from './routes';
import { freshIdentifier, signIn } from './session';
import { linkTo, sidebar } from './sidebar';

const IN_JUNE = '2026-06-15';

const JUNE_LAST = '2026-06-30';

const JUNE_LAST_REPORT = `${REPORT}?date=${JUNE_LAST}`;

const cashAndDeposits = (cash: string): readonly ReportRow[] => [
  ['Cash and deposits', cash],
  ['Cash', cash],
  ['Bank deposits', '0'],
];

const NOTHING_COUNTED: Report = {
  assets: cashAndDeposits('0'),
  totalAssets: '0',
  liabilities: [['Credit card payable', '0']],
  totalLiabilities: '0',
  netWorth: '0',
};

const NOTHING_COUNTED_COLLAPSED: Report = { ...NOTHING_COUNTED, assets: [['Cash and deposits', '0']] };

const LOANS_REPORT: Report = {
  assets: cashAndDeposits('4,000'),
  totalAssets: '4,000',
  liabilities: [['Credit card payable', '0'], ['Loans', '1,000'], ['Mortgage', '1,000']],
  totalLiabilities: '1,000',
  netWorth: '3,000',
};

const CASH_AND_DEPOSITS_COLLAPSED: Report = { ...LOANS_REPORT, assets: [['Cash and deposits', '4,000']] };

const BOTH_COLLAPSED: Report = {
  ...CASH_AND_DEPOSITS_COLLAPSED,
  liabilities: [['Credit card payable', '0'], ['Loans', '1,000']],
};

const LOANS_COLLAPSED: Report = { ...BOTH_COLLAPSED, assets: LOANS_REPORT.assets };

type Expanded = { readonly cashAndDeposits: boolean; readonly loans: boolean };

async function signInWithLoans(page: Page, identifier: string = freshIdentifier()): Promise<void> {
  const run = randomUUID();
  await signIn(page, { identifier, accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addGroup(page, 'Liabilities', { name: 'Loans' });
  await addAccount(page, 'Liabilities', { name: 'Mortgage', group: 'Loans', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    intoCash(IN_JUNE, `Paid in ${run}`, '3000'),
    entryOn(IN_JUNE, `Mortgaged ${run}`, 'Cash', added('Mortgage'), '1000'),
  ]);
}

async function expectGroups(page: Page, expanded: Expanded): Promise<void> {
  await expectGroupControls(reportTable(page, 'Assets'), { 'Cash and deposits': expanded.cashAndDeposits });
  await expectGroupControls(reportTable(page, 'Liabilities'), { Loans: expanded.loans });
}

const cashAndDepositsControl = (page: Page): Locator => groupControl(reportTable(page, 'Assets'), 'Cash and deposits');

const loansControl = (page: Page): Locator => groupControl(reportTable(page, 'Liabilities'), 'Loans');

test('shows a new User every Account group expanded with a control on its heading and none on an Account outside any group, and collapses and expands each group independently, keeping its name and subtotal and every total', async ({ page }) => {
  test.slow();
  await signInWithLoans(page);
  await page.goto(JUNE_LAST_REPORT);
  await expectReport(page, LOANS_REPORT);
  await expectGroups(page, { cashAndDeposits: true, loans: true });

  await cashAndDepositsControl(page).click();
  await expectGroups(page, { cashAndDeposits: false, loans: true });
  await expectReport(page, CASH_AND_DEPOSITS_COLLAPSED);

  await loansControl(page).click();
  await expectGroups(page, { cashAndDeposits: false, loans: false });
  await expectReport(page, BOTH_COLLAPSED);

  await cashAndDepositsControl(page).click();
  await expectGroups(page, { cashAndDeposits: true, loans: false });
  await expectReport(page, LOANS_COLLAPSED);

  await loansControl(page).click();
  await expectGroups(page, { cashAndDeposits: true, loans: true });
  await expectReport(page, LOANS_REPORT);
  await expect(page).toHaveURL(withQuery(REPORT, { date: JUNE_LAST }));
});

test("keeps a User's Collapsed groups through a reload, leaving and returning and a fresh browser signed in as the same User, leaves the Income statement's groups expanded, and leaves another User's groups expanded", async ({ browser }) => {
  test.slow();
  const identifier = freshIdentifier();
  const first = await browser.newContext();
  const page = await first.newPage();
  await signInWithLoans(page, identifier);
  await page.goto(JUNE_LAST_REPORT);
  await expectReport(page, LOANS_REPORT);

  await cashAndDepositsControl(page).click();
  await expectGroups(page, { cashAndDeposits: false, loans: true });

  await reloadUntilExpanded(page, cashAndDepositsControl(page), false);
  await expectGroups(page, { cashAndDeposits: false, loans: true });
  await expectReport(page, CASH_AND_DEPOSITS_COLLAPSED);

  await linkTo(sidebar(page), INCOME_STATEMENT_PATH).click();
  await expectGroupControls(statementTable(page, 'Expenses'), { 'Living expenses': true });
  await expectLabels(statementTable(page, 'Expenses'), [
    'Living expenses',
    'Food',
    'Transportation',
    'Other living expenses',
    'Total expense',
  ]);

  await linkTo(sidebar(page), REPORT).click();
  await expectGroups(page, { cashAndDeposits: false, loans: true });
  await expectLabels(reportTable(page, 'Assets'), ['Cash and deposits', 'Total assets']);

  const second = await browser.newContext();
  const again = await second.newPage();
  await signIn(again, { identifier });
  await again.goto(JUNE_LAST_REPORT);
  await expectGroups(again, { cashAndDeposits: false, loans: true });
  await expectReport(again, CASH_AND_DEPOSITS_COLLAPSED);

  const third = await browser.newContext();
  const other = await third.newPage();
  await signIn(other, { accountsStartOn: BOOKS_OPEN });
  await other.goto(JUNE_LAST_REPORT);
  await expectGroupControls(reportTable(other, 'Assets'), { 'Cash and deposits': true });
  await expectReport(other, NOTHING_COUNTED);

  await first.close();
  await second.close();
  await third.close();
});

test('reaches an Account group control by Tab and toggles it with Enter and Space, its aria-expanded matching whether the group is collapsed', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(JUNE_LAST_REPORT);
  await expectReport(page, NOTHING_COUNTED);
  const control = cashAndDepositsControl(page);

  await tabTo(page, control);
  await page.keyboard.press('Enter');
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(control).toBeFocused();
  await expectReport(page, NOTHING_COUNTED_COLLAPSED);

  await page.keyboard.press('Space');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expect(control).toBeFocused();
  await expectReport(page, NOTHING_COUNTED);
});

test('keeps an Account group as toggled when keeping the choice fails, showing no error, and shows it as last kept after a reload', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(JUNE_LAST_REPORT);
  await expectReport(page, NOTHING_COUNTED);
  await cashAndDepositsControl(page).click();
  await reloadUntilExpanded(page, cashAndDepositsControl(page), false);
  await expectReport(page, NOTHING_COUNTED_COLLAPSED);
  await abortServerActions(page, REPORT);
  const failedSave = failedServerAction(page);

  await cashAndDepositsControl(page).click();
  await failedSave;

  await expect(cashAndDepositsControl(page)).toHaveAttribute('aria-expanded', 'true');
  await expectReport(page, NOTHING_COUNTED);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();

  await expect(cashAndDepositsControl(page)).toHaveAttribute('aria-expanded', 'false');
  await expectReport(page, NOTHING_COUNTED_COLLAPSED);
});
