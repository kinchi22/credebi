import { expect, type Locator, type Page } from '@playwright/test';
import { expectRows, namedTable, type ReportPanels, type ReportRow } from './report-tables';

export const periodForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Statement period', exact: true });

const periodFrom = (page: Page): Locator =>
  periodForm(page).getByLabel('From', { exact: true });

const periodTo = (page: Page): Locator =>
  periodForm(page).getByLabel('To', { exact: true });

const showButton = (page: Page): Locator =>
  periodForm(page).getByRole('button', { name: 'Show', exact: true });

export async function showStatement(page: Page, from: string, to: string): Promise<void> {
  await expect(periodForm(page)).toBeVisible();
  await periodFrom(page).fill(from);
  await periodTo(page).fill(to);
  await showButton(page).click();
}

export async function expectPeriod(page: Page, from: string, to: string): Promise<void> {
  await expect(periodFrom(page)).toHaveValue(from);
  await expect(periodTo(page)).toHaveValue(to);
}

export type StatementTable = 'Revenue' | 'Expenses' | 'Totals';

export const statementTable = (page: Page, name: StatementTable): Locator => namedTable(page, name);

export const accountLink = (page: Page, table: StatementTable, name: string): Locator =>
  statementTable(page, table).getByRole('link', { name, exact: true });

export const statementPanels = (page: Page): ReportPanels => ({
  left: statementTable(page, 'Expenses'),
  right: statementTable(page, 'Revenue'),
  totals: statementTable(page, 'Totals'),
});

export type Statement = {
  readonly revenue: readonly ReportRow[];
  readonly totalRevenue: string;
  readonly expenses: readonly ReportRow[];
  readonly totalExpense: string;
  readonly netIncome: string;
};

export async function expectStatement(page: Page, statement: Statement): Promise<void> {
  await expectRows(statementTable(page, 'Revenue'), [
    ...statement.revenue,
    ['Total revenue', statement.totalRevenue],
  ]);
  await expectRows(statementTable(page, 'Expenses'), [
    ...statement.expenses,
    ['Total expense', statement.totalExpense],
  ]);
  await expectRows(statementTable(page, 'Totals'), [
    ['Total revenue', statement.totalRevenue],
    ['Total expense', statement.totalExpense],
    ['Net income', statement.netIncome],
  ]);
}
