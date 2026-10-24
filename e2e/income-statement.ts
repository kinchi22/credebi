import { expect, type Locator, type Page } from '@playwright/test';

export const periodForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Statement period', exact: true });

export const periodFrom = (page: Page): Locator =>
  periodForm(page).getByLabel('From', { exact: true });

export const periodTo = (page: Page): Locator =>
  periodForm(page).getByLabel('To', { exact: true });

export const showButton = (page: Page): Locator =>
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

export const statementTable = (page: Page, name: StatementTable): Locator =>
  page.getByRole('main').getByRole('table', { name, exact: true });

export const statementTables = (page: Page): Locator => page.getByRole('main').getByRole('table');

export const statementRow = (table: Locator, label: string): Locator =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name: label, exact: true }) });

export const accountLink = (page: Page, table: StatementTable, name: string): Locator =>
  statementTable(page, table).getByRole('link', { name, exact: true });

export type StatementRow = readonly [label: string, amount: string];

async function expectRows(table: Locator, rows: readonly StatementRow[]): Promise<void> {
  await expect(table.getByRole('rowheader')).toHaveText(rows.map(([label]) => label));
  for (const [label, amount] of rows) {
    await expect(statementRow(table, label).getByRole('cell')).toHaveText([amount]);
  }
}

export type Statement = {
  readonly revenue: readonly StatementRow[];
  readonly totalRevenue: string;
  readonly expenses: readonly StatementRow[];
  readonly totalExpense: string;
  readonly difference: string;
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
    ['Difference', statement.difference],
  ]);
}
