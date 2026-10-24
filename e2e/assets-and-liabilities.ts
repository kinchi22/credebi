import { expect, type Locator, type Page } from '@playwright/test';
import { expectRows, type ReportPanels, type ReportRow } from './report-tables';

export const reportDateForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Report date', exact: true });

export const reportDate = (page: Page): Locator =>
  reportDateForm(page).getByLabel('Date', { exact: true });

const showButton = (page: Page): Locator =>
  reportDateForm(page).getByRole('button', { name: 'Show', exact: true });

export async function showReport(page: Page, day: string): Promise<void> {
  await expect(reportDateForm(page)).toBeVisible();
  await reportDate(page).fill(day);
  await showButton(page).click();
}

export type ReportTable = 'Assets' | 'Liabilities' | 'Totals';

export const reportTable = (page: Page, name: ReportTable): Locator =>
  page.getByRole('main').getByRole('table', { name, exact: true });

export const reportTables = (page: Page): Locator => page.getByRole('main').getByRole('table');

export const reportPanels = (page: Page): ReportPanels => ({
  left: reportTable(page, 'Assets'),
  right: reportTable(page, 'Liabilities'),
  totals: reportTable(page, 'Totals'),
});

export type Report = {
  readonly assets: readonly ReportRow[];
  readonly totalAssets: string;
  readonly liabilities: readonly ReportRow[];
  readonly totalLiabilities: string;
  readonly netWorth: string;
};

export async function expectReport(page: Page, report: Report): Promise<void> {
  await expect(reportTables(page)).toHaveCount(3);
  await expectRows(reportTable(page, 'Assets'), [...report.assets, ['Total assets', report.totalAssets]]);
  await expectRows(reportTable(page, 'Liabilities'), [
    ...report.liabilities,
    ['Total liabilities', report.totalLiabilities],
  ]);
  await expectRows(reportTable(page, 'Totals'), [
    ['Total assets', report.totalAssets],
    ['Total liabilities', report.totalLiabilities],
    ['Net worth', report.netWorth],
  ]);
}
