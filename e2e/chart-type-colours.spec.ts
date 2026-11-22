import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import {
  drawnLines,
  expectDrawnLines,
  expectMonths,
  expectSwatches,
  expectTooltip,
  fromMonth,
  legendItem,
  swatchIn,
  type TrendMonth,
  trendChart,
  trendTooltip,
} from './assets-and-liabilities-trend';
import { entryOn, intoCash, postEntries } from './entries';
import { expectTrendPreviewColours } from './landing';
import { tabTo } from './language';
import { TREND_PATH } from './routes';
import { signIn } from './session';

const JUNE: TrendMonth = ['2026-06', '3,000', '0', '3,000'];

const JULY: TrendMonth = ['2026-07', '3,000', '5,000', '-2,000'];

async function openJuneAndJuly(page: Page): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2026-06-15', `Paid in ${randomUUID()}`, '3000'),
    entryOn('2026-07-15', `Charged ${randomUUID()}`, 'Food', 'Credit card payable', '5000'),
  ]);
  await page.goto(`${TREND_PATH}?from=2026-06&to=2026-07`);
  await expectMonths(page, [JUNE, JULY]);
}

test('draws total assets in the asset colour, total liabilities in the liability colour and dashed, and Net worth in accent-text', async ({ page }) => {
  await openJuneAndJuly(page);

  await expectDrawnLines(drawnLines(trendChart(page)));
});

test("matches each legend item's swatch and each tooltip row's swatch to its line's colour", async ({ page }) => {
  await openJuneAndJuly(page);

  await expectSwatches((line) => swatchIn(legendItem(page, line)), 'legend');

  await expect(fromMonth(page)).toBeVisible();
  await tabTo(page, trendChart(page));
  await expectTooltip(page, JUNE);
  await expectSwatches((line) => swatchIn(trendTooltip(page).getByText(line, { exact: true })), 'tooltip');
});

test("draws the trend preview's three lines and legend swatches in the same colours as the app", async ({ page }) => {
  await page.goto('/');

  await expectTrendPreviewColours(page);
});
