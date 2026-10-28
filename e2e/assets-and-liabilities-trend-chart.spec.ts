import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { BOOKS_OPEN, bottom, boxOf } from './accounts';
import {
  expectMonths,
  expectTooltip,
  fromMonth,
  legendItem,
  topTick,
  TREND_LINES,
  type TrendLine,
  type TrendMonth,
  trendChart,
  trendTooltip,
} from './assets-and-liabilities-trend';
import { entryOn, postEntries, type TwoLineEntry } from './entries';
import { tabTo } from './language';
import { abortServerActions, TREND_PATH as TREND } from './routes';
import { freshIdentifier, signIn } from './session';

const IN_JUNE = '2026-06-15';

const ONE_HUNDRED_MILLION = 100_000_000;

const TEN_MILLION = 10_000_000;

const intoCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Cash', 'Opening balance equity', amount);

const juneAndJuly: readonly TrendMonth[] = [
  ['2026-06', '1,000', '0', '1,000'],
  ['2026-07', '1,000', '0', '1,000'],
];

async function openJuneAndJuly(page: Page): Promise<void> {
  await page.goto(`${TREND}?from=2026-06&to=2026-07`);
  await expectMonths(page, juneAndJuly);
}

async function expectShown(page: Page, shown: readonly TrendLine[]): Promise<void> {
  for (const line of TREND_LINES) {
    await expect(legendItem(page, line)).toHaveAttribute('aria-pressed', String(shown.includes(line)));
  }
}

const allBut = (hidden: TrendLine): readonly TrendLine[] => TREND_LINES.filter((line) => line !== hidden);

test('reads every month of the trend by keyboard from the chart, its tooltip naming the month and its three values', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash(IN_JUNE, `Paid in ${run}`, '3000'),
    entryOn('2026-07-15', `Charged ${run}`, 'Food', 'Credit card payable', '5000'),
  ]);
  await page.goto(`${TREND}?from=2026-06&to=2026-08`);
  const june: TrendMonth = ['2026-06', '3,000', '0', '3,000'];
  const july: TrendMonth = ['2026-07', '3,000', '5,000', '-2,000'];
  const august: TrendMonth = ['2026-08', '3,000', '5,000', '-2,000'];
  await expectMonths(page, [june, july, august]);
  await expect(trendTooltip(page)).toHaveCount(0);

  await expect(fromMonth(page)).toBeVisible();
  await tabTo(page, trendChart(page));
  await expectTooltip(page, june);

  await page.keyboard.press('ArrowRight');
  await expectTooltip(page, july);
  await page.keyboard.press('ArrowRight');
  await expectTooltip(page, august);
  await page.keyboard.press('ArrowRight');
  await expectTooltip(page, august);

  await page.keyboard.press('ArrowLeft');
  await expectTooltip(page, july);
});

test('shows all three lines at first, named in a legend centred below the chart, and hides and shows each from its legend item while the table keeps every value', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await openJuneAndJuly(page);

  await expectShown(page, TREND_LINES);
  const chart = await boxOf(trendChart(page), 'the chart');
  const items = await Promise.all(TREND_LINES.map((line) => boxOf(legendItem(page, line), `the ${line} legend item`)));
  for (const item of items) {
    expect(item.y).toBeGreaterThanOrEqual(bottom(chart));
  }
  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  expect(Math.abs((left + right) / 2 - (chart.x + chart.width / 2))).toBeLessThanOrEqual(4);

  for (const line of TREND_LINES) {
    await legendItem(page, line).click();
    await expectShown(page, allBut(line));
    await expectMonths(page, juneAndJuly);

    await legendItem(page, line).click();
    await expectShown(page, TREND_LINES);
  }
});

test('lets every line be hidden, keeping the chart, its axes, the legend and the table in place, and brings a line back', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await openJuneAndJuly(page);

  for (const line of TREND_LINES) {
    await legendItem(page, line).click();
  }

  await expectShown(page, []);
  await expect(trendChart(page)).toBeVisible();
  await expect(trendChart(page).getByText('26.06', { exact: true })).toBeVisible();
  for (const line of TREND_LINES) {
    await expect(legendItem(page, line)).toBeVisible();
  }
  await expectMonths(page, juneAndJuly);

  await legendItem(page, 'Net worth').click();
  await expectShown(page, ['Net worth']);
});

test('refits the y axis to the lines shown and zero, so hiding total liabilities far larger than total assets lowers its top tick, and keeps the axis when every line is hidden', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash(IN_JUNE, `Savings ${run}`, String(TEN_MILLION)),
    entryOn(IN_JUNE, `Mortgage ${run}`, 'Food', 'Credit card payable', String(ONE_HUNDRED_MILLION)),
  ]);
  await page.goto(`${TREND}?from=2026-06&to=2026-07`);
  const mortgaged: TrendMonth[] = ['2026-06', '2026-07'].map(
    (month) => [month, '10,000,000', '100,000,000', '-90,000,000'] as const,
  );
  await expectMonths(page, mortgaged);
  await expect.poll(() => topTick(page)).toBeGreaterThanOrEqual(ONE_HUNDRED_MILLION);

  await legendItem(page, 'Total liabilities').click();
  await expectShown(page, allBut('Total liabilities'));
  await expect.poll(() => topTick(page)).toBeLessThan(ONE_HUNDRED_MILLION);

  await legendItem(page, 'Net worth').click();
  await expectShown(page, ['Total assets']);
  await expect.poll(() => topTick(page)).toBeLessThan(ONE_HUNDRED_MILLION);
  await expect.poll(() => topTick(page)).toBeGreaterThanOrEqual(TEN_MILLION);
  await expect(trendChart(page).getByText('0', { exact: true })).toBeVisible();
  const fitted = await topTick(page);

  await legendItem(page, 'Total assets').click();
  await expectShown(page, []);
  await expect.poll(() => topTick(page)).toBe(fitted);
  await expectMonths(page, mortgaged);
});

test("keeps which lines are shown in the User's Settings, through a reload and in a fresh browser signed in as the same User, and leaves another User's lines all shown", async ({ browser }) => {
  const identifier = freshIdentifier();
  const first = await browser.newContext();
  const page = await first.newPage();
  await signIn(page, { identifier, accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await openJuneAndJuly(page);
  await expectShown(page, TREND_LINES);

  await legendItem(page, 'Total liabilities').click();
  await expectShown(page, allBut('Total liabilities'));

  await expect(async () => {
    await page.reload();
    await expect(legendItem(page, 'Total liabilities')).toHaveAttribute('aria-pressed', 'false', { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expectMonths(page, juneAndJuly);
  await expectShown(page, allBut('Total liabilities'));

  const second = await browser.newContext();
  const again = await second.newPage();
  await signIn(again, { identifier });
  await openJuneAndJuly(again);
  await expectShown(again, allBut('Total liabilities'));

  const third = await browser.newContext();
  const other = await third.newPage();
  await signIn(other, { accountsStartOn: BOOKS_OPEN });
  await postEntries(other, [intoCash(IN_JUNE, `Own cash ${randomUUID()}`, '1000')]);
  await openJuneAndJuly(other);
  await expectShown(other, TREND_LINES);

  await first.close();
  await second.close();
  await third.close();
});

test('keeps a line as pressed when saving the choice fails, showing no error, and shows it again after a reload', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await openJuneAndJuly(page);
  await abortServerActions(page, TREND);
  const failedSave = page.waitForEvent(
    'requestfailed',
    (request) => request.method() === 'POST' && request.headers()['next-action'] !== undefined,
  );

  await legendItem(page, 'Net worth').click();
  await failedSave;

  await expectShown(page, allBut('Net worth'));
  await expectMonths(page, juneAndJuly);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();

  await expectMonths(page, juneAndJuly);
  await expectShown(page, TREND_LINES);
});
