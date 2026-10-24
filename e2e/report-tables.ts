import { expect, type Locator } from '@playwright/test';
import { bottom, type Box, boxOf } from './accounts';

export type ReportRow = readonly [label: string, amount: string];

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

export async function expectOneColumn(stacked: readonly Locator[]): Promise<void> {
  const boxes: Box[] = [];
  for (const [index, table] of stacked.entries()) {
    boxes.push(await boxOf(table, `table ${String(index + 1)} of the column`));
  }
  const [first, ...rest] = boxes;
  expect(first, 'the column holds a table').toBeDefined();
  let above = first ?? { x: Number.NaN, y: Number.NaN, width: 0, height: 0 };
  for (const box of rest) {
    expect(box.x).toBeCloseTo(above.x, 0);
    expect(box.y).toBeGreaterThanOrEqual(bottom(above));
    above = box;
  }
}
