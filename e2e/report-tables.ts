import { expect, type Locator, type Page } from '@playwright/test';
import { bottom, type Box, boxOf } from './accounts';

export type ReportRow = readonly [label: string, amount: string];

export const reportTables = (page: Page): Locator => page.getByRole('main').getByRole('table');

export const namedTable = (page: Page, name: string): Locator =>
  page.getByRole('main').getByRole('table', { name, exact: true });

export const atZero = (names: readonly string[]): ReportRow[] => names.map((name) => [name, '0'] as const);

export const zeroRows = (first: string, names: readonly string[]): ReportRow[] => atZero([first, ...names]);

const reportRow = (table: Locator, label: string): Locator =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name: label, exact: true }) });

export async function expectRows(table: Locator, rows: readonly ReportRow[]): Promise<void> {
  await expect(table.getByRole('rowheader')).toHaveText(rows.map(([label]) => label));
  for (const [label, amount] of rows) {
    await expect(reportRow(table, label).getByRole('cell')).toHaveText([amount]);
  }
}

export type Column = 'left' | 'right';

export type ReportPanels = Readonly<Record<Column | 'totals', Locator>>;

type PanelBoxes = Readonly<Record<Column | 'totals', Box>>;

const OTHER_COLUMN: Record<Column, Column> = { left: 'right', right: 'left' };

async function boxesOf(panels: ReportPanels): Promise<PanelBoxes> {
  return {
    left: await boxOf(panels.left, 'the left table'),
    right: await boxOf(panels.right, 'the right table'),
    totals: await boxOf(panels.totals, 'the Totals table'),
  };
}

export async function expectTwoColumnsWithTotalsUnder(panels: ReportPanels, under: Column): Promise<PanelBoxes> {
  const boxes = await boxesOf(panels);
  const { left, right, totals } = boxes;
  const column = boxes[under];
  expect(left.x + left.width).toBeLessThanOrEqual(right.x);
  expect(right.y).toBeCloseTo(left.y, 0);
  expect(totals.x).toBeCloseTo(column.x, 0);
  expect(totals.x + totals.width).toBeCloseTo(column.x + column.width, 0);
  expect(totals.y).toBeGreaterThanOrEqual(bottom(column));
  return boxes;
}

export async function expectTotalsDirectlyBelowShorter(panels: ReportPanels, shorter: Column): Promise<void> {
  const boxes = await expectTwoColumnsWithTotalsUnder(panels, shorter);
  expect(boxes.totals.y).toBeLessThan(bottom(boxes[OTHER_COLUMN[shorter]]));
}

export async function expectOneColumn(top: Locator, ...below: readonly Locator[]): Promise<void> {
  let above = await boxOf(top, 'the top table of the column');
  for (const table of below) {
    const box = await boxOf(table, 'a table lower in the column');
    expect(box.x).toBeCloseTo(above.x, 0);
    expect(box.y).toBeGreaterThanOrEqual(bottom(above));
    above = box;
  }
}
