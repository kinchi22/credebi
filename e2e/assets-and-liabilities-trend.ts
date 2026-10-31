import { expect, type Locator, type Page } from '@playwright/test';
import { escaped } from './entries';
import { reportRow, reportTables } from './report-tables';

export const TREND_LINES = ['Net worth', 'Total assets', 'Total liabilities'] as const;

export type TrendLine = (typeof TREND_LINES)[number];

export const MOST_MONTHS = 600;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const yearAndMonth = (month: string): readonly [number, number] => [
  Number(month.slice(0, 4)),
  Number(month.slice(5, 7)),
];

export const monthLabel = (month: string): string => {
  const [year, number] = yearAndMonth(month);
  return `${MONTH_NAMES[number - 1] ?? ''} ${String(year)}`;
};

export const monthsFrom = (first: string, count: number): readonly string[] => {
  const [year, number] = yearAndMonth(first);
  return Array.from({ length: count }, (_, offset) => {
    const index = year * 12 + number - 1 + offset;
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
};

export const rangeForm = (page: Page): Locator => page.getByRole('form', { name: 'Trend range', exact: true });

export const fromMonth = (page: Page): Locator => rangeForm(page).getByLabel('From month', { exact: true });

export const toMonth = (page: Page): Locator => rangeForm(page).getByLabel('To month', { exact: true });

export const showButton = (page: Page): Locator =>
  rangeForm(page).getByRole('button', { name: 'Show', exact: true });

export async function showTrend(page: Page, from: string, to: string): Promise<void> {
  await expect(rangeForm(page)).toBeVisible();
  await fromMonth(page).fill(from);
  await toMonth(page).fill(to);
  await showButton(page).click();
}

export async function expectRange(page: Page, from: string, to: string): Promise<void> {
  await expect(fromMonth(page)).toHaveValue(from);
  await expect(toMonth(page)).toHaveValue(to);
}

export const trendChart = (page: Page): Locator => page.getByRole('main').getByRole('application');

export const trendTable = reportTables;

const lineButton = (page: Page, name: string): Locator =>
  page.getByRole('main').getByRole('button', { name, exact: true });

export const legendItem = (page: Page, line: TrendLine): Locator => lineButton(page, line);

export const trendTooltip = (page: Page): Locator => page.getByRole('main').getByRole('tooltip');

export const nothingRecorded = (page: Page): Locator => page.getByRole('main').getByText(/nothing recorded/i);

export type TrendMonth = readonly [month: string, totalAssets: string, totalLiabilities: string, netWorth: string];

export const monthCells = (page: Page, month: string): Locator =>
  reportRow(trendTable(page), monthLabel(month)).getByRole('cell');

export async function expectMonths(page: Page, months: readonly TrendMonth[]): Promise<void> {
  await expect(trendChart(page)).toBeVisible();
  const table = trendTable(page);
  await expect(table).toHaveCount(1);
  await expect(table.getByRole('columnheader')).toHaveText(['Month', 'Total assets', 'Total liabilities', 'Net worth']);
  await expect(table.getByRole('rowheader')).toHaveText(months.map(([month]) => monthLabel(month)));
  for (const [month, ...amounts] of months) {
    await expect(monthCells(page, month)).toHaveText(amounts);
  }
}

export async function expectNoTrend(
  page: Page,
  form: Locator = rangeForm(page),
  lines: readonly string[] = TREND_LINES,
): Promise<void> {
  await expect(form).toBeVisible();
  await expect(trendChart(page)).toHaveCount(0);
  await expect(trendTable(page)).toHaveCount(0);
  for (const line of lines) {
    await expect(lineButton(page, line)).toHaveCount(0);
  }
}

export async function expectRefused(page: Page): Promise<void> {
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/month/i);
  await expectNoTrend(page);
}

export async function expectNothingRecorded(page: Page): Promise<void> {
  await expect(nothingRecorded(page)).toBeVisible();
  await expectNoTrend(page);
}

const shownValue = (line: string, amount: string): RegExp =>
  new RegExp(`${escaped(line)}\\s*${escaped(amount)}(?![\\d,.])`);

export async function expectTooltip(page: Page, [month, totalAssets, totalLiabilities, netWorth]: TrendMonth): Promise<void> {
  const tooltip = trendTooltip(page);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(monthLabel(month));
  await expect(tooltip).toContainText(shownValue('Net worth', netWorth));
  await expect(tooltip).toContainText(shownValue('Total assets', totalAssets));
  await expect(tooltip).toContainText(shownValue('Total liabilities', totalLiabilities));
}

const COMPACT_TICK = /^-?\d+(?:\.\d+)?[KMB]$/;

const SCALE: Readonly<Record<string, number>> = { K: 1e3, M: 1e6, B: 1e9 };

const valueOfTick = (tick: string): number => Number(tick.slice(0, -1)) * (SCALE[tick.slice(-1)] ?? Number.NaN);

export async function topTick(page: Page): Promise<number> {
  const ticks = await trendChart(page).getByText(COMPACT_TICK).allTextContents();
  return ticks.length === 0 ? Number.NaN : Math.max(...ticks.map((tick) => valueOfTick(tick.trim())));
}
