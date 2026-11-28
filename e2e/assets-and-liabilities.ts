import { expect, type Locator, type Page } from '@playwright/test';
import { expectRows, namedTable, type ReportPanels, type ReportRow, reportTables } from './report-tables';

const REPORT_DATE_NAMES = /^(Report date|\uAE30\uC900\uC77C|\u57FA\u6E96\u65E5)$/;

const DATE_LABELS = /^(Date|\uB0A0\uC9DC|\u65E5\u4ED8)$/;

const SHOW_LABELS = /^(Show|\uC870\uD68C|\u8868\u793A)$/;

export const reportDateForm = (page: Page): Locator => page.getByRole('form', { name: REPORT_DATE_NAMES });

export const reportDate = (page: Page): Locator =>
  reportDateForm(page).getByLabel(DATE_LABELS);

export const showButton = (page: Page): Locator => reportDateForm(page).getByRole('button', { name: SHOW_LABELS });

export const reportDatePickerButton = (page: Page): Locator =>
  reportDateForm(page).getByRole('button').filter({ hasNotText: SHOW_LABELS });

export async function showReport(page: Page, day: string): Promise<void> {
  await expect(reportDateForm(page)).toBeVisible();
  await reportDate(page).fill(day);
  await showButton(page).click();
}

export type ReportTable = 'Assets' | 'Liabilities' | 'Totals';

export const reportTable = (page: Page, name: ReportTable): Locator => namedTable(page, name);

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
