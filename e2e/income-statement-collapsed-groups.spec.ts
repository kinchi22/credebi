import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN } from './accounts';
import { reportTable } from './assets-and-liabilities';
import { added, entryOn, postEntries } from './entries';
import { expectPeriod, expectStatement, type Statement, statementTable } from './income-statement';
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
  ASSETS_AND_LIABILITIES_PATH,
  failedServerAction,
  INCOME_STATEMENT_PATH as STATEMENT,
  SETTINGS_PATH,
} from './routes';
import { freshIdentifier, signIn } from './session';
import { linkTo, sidebar } from './sidebar';

const JUNE_FIRST = '2026-06-01';

const JUNE_LAST = '2026-06-30';

const IN_JUNE = '2026-06-15';

const JUNE_STATEMENT = `${STATEMENT}?from=${JUNE_FIRST}&to=${JUNE_LAST}`;

const livingExpenses = (food: string): readonly ReportRow[] => [
  ['Living expenses', food],
  ['Food', food],
  ['Transportation', '0'],
  ['Other living expenses', '0'],
];

const NOTHING_COUNTED: Statement = {
  revenue: [['Salary', '0']],
  totalRevenue: '0',
  expenses: livingExpenses('0'),
  totalExpense: '0',
  netIncome: '0',
};

const NOTHING_COUNTED_COLLAPSED: Statement = { ...NOTHING_COUNTED, expenses: [['Living expenses', '0']] };

const PAY_STATEMENT: Statement = {
  revenue: [['Salary', '0'], ['Pay', '10,000'], ['Base pay', '10,000']],
  totalRevenue: '10,000',
  expenses: livingExpenses('1,000'),
  totalExpense: '1,000',
  netIncome: '9,000',
};

const LIVING_EXPENSES_COLLAPSED: Statement = { ...PAY_STATEMENT, expenses: [['Living expenses', '1,000']] };

const BOTH_COLLAPSED: Statement = { ...LIVING_EXPENSES_COLLAPSED, revenue: [['Salary', '0'], ['Pay', '10,000']] };

const PAY_COLLAPSED: Statement = { ...BOTH_COLLAPSED, expenses: PAY_STATEMENT.expenses };

type Expanded = { readonly pay: boolean; readonly livingExpenses: boolean };

async function signInWithPay(page: Page, identifier: string = freshIdentifier()): Promise<void> {
  const run = randomUUID();
  await signIn(page, { identifier, accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addGroup(page, 'Revenue', { name: 'Pay' });
  await addAccount(page, 'Revenue', { name: 'Base pay', group: 'Pay', activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    entryOn(IN_JUNE, `Pay ${run}`, 'Cash', added('Base pay'), '10000'),
    entryOn(IN_JUNE, `Stationery ${run}`, 'Food', 'Cash', '1000'),
  ]);
}

async function expectGroups(page: Page, expanded: Expanded): Promise<void> {
  await expectGroupControls(statementTable(page, 'Revenue'), { Pay: expanded.pay });
  await expectGroupControls(statementTable(page, 'Expenses'), { 'Living expenses': expanded.livingExpenses });
}

const payControl = (page: Page): Locator => groupControl(statementTable(page, 'Revenue'), 'Pay');

const livingExpensesControl = (page: Page): Locator =>
  groupControl(statementTable(page, 'Expenses'), 'Living expenses');

test('shows a new User every Account group expanded with a control on its heading and none on an Account outside any group, and collapses and expands each group independently, keeping its name and subtotal and every total', async ({ page }) => {
  test.slow();
  await signInWithPay(page);
  await page.goto(JUNE_STATEMENT);
  await expectStatement(page, PAY_STATEMENT);
  await expectGroups(page, { pay: true, livingExpenses: true });

  await livingExpensesControl(page).click();
  await expectGroups(page, { pay: true, livingExpenses: false });
  await expectStatement(page, LIVING_EXPENSES_COLLAPSED);

  await payControl(page).click();
  await expectGroups(page, { pay: false, livingExpenses: false });
  await expectStatement(page, BOTH_COLLAPSED);

  await livingExpensesControl(page).click();
  await expectGroups(page, { pay: false, livingExpenses: true });
  await expectStatement(page, PAY_COLLAPSED);

  await payControl(page).click();
  await expectGroups(page, { pay: true, livingExpenses: true });
  await expectStatement(page, PAY_STATEMENT);
  await expectPeriod(page, JUNE_FIRST, JUNE_LAST);
});

test("keeps a User's Collapsed groups through a reload, leaving and returning and a fresh browser signed in as the same User, leaves Assets and liabilities' groups expanded, and leaves another User's groups expanded", async ({ browser }) => {
  test.slow();
  const identifier = freshIdentifier();
  const first = await browser.newContext();
  const page = await first.newPage();
  await signInWithPay(page, identifier);
  await page.goto(JUNE_STATEMENT);
  await expectStatement(page, PAY_STATEMENT);

  await livingExpensesControl(page).click();
  await expectGroups(page, { pay: true, livingExpenses: false });

  await reloadUntilExpanded(page, livingExpensesControl(page), false);
  await expectGroups(page, { pay: true, livingExpenses: false });
  await expectStatement(page, LIVING_EXPENSES_COLLAPSED);

  await linkTo(sidebar(page), ASSETS_AND_LIABILITIES_PATH).click();
  await expectGroupControls(reportTable(page, 'Assets'), { 'Cash and deposits': true });
  await expectLabels(reportTable(page, 'Assets'), ['Cash and deposits', 'Cash', 'Bank deposits', 'Total assets']);

  await linkTo(sidebar(page), STATEMENT).click();
  await expectGroups(page, { pay: true, livingExpenses: false });
  await expectLabels(statementTable(page, 'Expenses'), ['Living expenses', 'Total expense']);

  const second = await browser.newContext();
  const again = await second.newPage();
  await signIn(again, { identifier });
  await again.goto(JUNE_STATEMENT);
  await expectGroups(again, { pay: true, livingExpenses: false });
  await expectStatement(again, LIVING_EXPENSES_COLLAPSED);

  const third = await browser.newContext();
  const other = await third.newPage();
  await signIn(other, { accountsStartOn: BOOKS_OPEN });
  await other.goto(JUNE_STATEMENT);
  await expectGroupControls(statementTable(other, 'Expenses'), { 'Living expenses': true });
  await expectStatement(other, NOTHING_COUNTED);

  await first.close();
  await second.close();
  await third.close();
});

test('reaches an Account group control by Tab and toggles it with Enter and Space, its aria-expanded matching whether the group is collapsed', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(JUNE_STATEMENT);
  await expectStatement(page, NOTHING_COUNTED);
  const control = livingExpensesControl(page);

  await tabTo(page, control);
  await page.keyboard.press('Enter');
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(control).toBeFocused();
  await expectStatement(page, NOTHING_COUNTED_COLLAPSED);

  await page.keyboard.press('Space');
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await expect(control).toBeFocused();
  await expectStatement(page, NOTHING_COUNTED);
});

test('keeps an Account group as toggled when keeping the choice fails, showing no error, and shows it as last kept after a reload', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(JUNE_STATEMENT);
  await expectStatement(page, NOTHING_COUNTED);
  await livingExpensesControl(page).click();
  await reloadUntilExpanded(page, livingExpensesControl(page), false);
  await expectStatement(page, NOTHING_COUNTED_COLLAPSED);
  await abortServerActions(page, STATEMENT);
  const failedSave = failedServerAction(page);

  await livingExpensesControl(page).click();
  await failedSave;

  await expect(livingExpensesControl(page)).toHaveAttribute('aria-expanded', 'true');
  await expectStatement(page, NOTHING_COUNTED);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();

  await expect(livingExpensesControl(page)).toHaveAttribute('aria-expanded', 'false');
  await expectStatement(page, NOTHING_COUNTED_COLLAPSED);
});
