import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import {
  expectMonths,
  expectNothingRecorded,
  expectNoTrend,
  expectRange,
  expectRefused,
  legendItem,
  monthLabel,
  monthsFrom,
  MOST_MONTHS,
  rangeForm,
  showButton,
  showTrend,
  TREND_LINES,
  type TrendMonth,
  monthCells,
  trendChart,
  trendTable,
  trendTooltip,
} from './assets-and-liabilities-trend';
import { category, choosePeriod, choosePreset, datePresets, fixToday, periodSheet, presetChoice } from './date-presets';
import { entryOn, postEntries, type TwoLineEntry } from './entries';
import { documentLanguage, expectSettingsPageIn, languageChoice, pageTitle, tabTo } from './language';
import {
  abortServerActions,
  ASSETS_AND_LIABILITIES_PATH,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  SIGN_IN_URL,
  TREND_PATH as TREND,
  TREND_WITHOUT_QUERY,
  withQuery,
} from './routes';
import { freshIdentifier, signIn, signInForSmoke, submitTestSignIn } from './session';
import { linkTo, menu, SIGNED_IN_PAGES, sidebar } from './sidebar';
import { HANGUL } from './typed-text';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const TODAY = '2026-09-15';

const IN_JUNE = '2026-06-15';

const AHEAD_OF_THE_SERVER = 'Pacific/Kiritimati';

const PLUS_MINUS = '\u00B1';

const SIDEBAR_LINKS = [
  'Entries',
  'Entry search',
  'Income statement',
  'Assets and liabilities',
  'Assets and liabilities trend',
  'Settings',
] as const;

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

type Translation = {
  readonly script: RegExp;
  readonly pageName: string;
  readonly lines: readonly [netWorth: string, totalAssets: string, totalLiabilities: string];
  readonly categories: readonly string[];
};

const TRANSLATIONS = {
  ko: {
    script: HANGUL,
    pageName: '\uC790\uC0B0\u00B7\uBD80\uCC44 \uCD94\uC774',
    lines: ['\uC21C\uC790\uC0B0', '\uC790\uC0B0 \uD569\uACC4', '\uBD80\uCC44 \uD569\uACC4'],
    categories: ['\uC5F0\uB3C4', '\uBD84\uAE30', '\uC6D4', '\uC0C1\uB300 \uAE30\uAC04'],
  },
  ja: {
    script: JAPANESE,
    pageName: '\u8CC7\u7523\u30FB\u8CA0\u50B5\u63A8\u79FB',
    lines: ['\u7D14\u8CC7\u7523', '\u8CC7\u7523\u5408\u8A08', '\u8CA0\u50B5\u5408\u8A08'],
    categories: ['\u5E74', '\u56DB\u534A\u671F', '\u6708', '\u76F8\u5BFE\u671F\u9593'],
  },
} as const satisfies Record<string, Translation>;

const RELATIVE_SPANS = [3, 6, 12, 24, 36] as const;

const RELATIVE_CHOICES = RELATIVE_SPANS.flatMap((months) => [
  `Last ${String(months)} months`,
  `Next ${String(months)} months`,
  `${PLUS_MINUS}${String(months)} months`,
]);

const intoCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Cash', 'Opening balance equity', amount);

const cash = (month: string, amount: string): TrendMonth => [month, amount, '0', amount];

const cashIn = (months: readonly string[], amount: string): TrendMonth[] =>
  months.map((month) => cash(month, amount));

const cashFrom = (months: readonly string[], since: string, amount: string): TrendMonth[] =>
  months.map((month) => cash(month, month < since ? '0' : amount));

const ranged = (from: string, to: string): string => `${TREND}?from=${from}&to=${to}`;

const trendLinkIn = (navigation: Locator): Locator => linkTo(navigation, TREND);

const trendLink = (page: Page): Locator => trendLinkIn(sidebar(page));

async function expectShownRange(page: Page, from: string, to: string): Promise<void> {
  await expect(page).toHaveURL(withQuery(TREND, { from, to }));
  await expectRange(page, from, to);
}

test("opens with no range on the twelve months ending with the browser's current month, ahead of the server's, filled into From month and To month with the URL unchanged", async ({ browser }) => {
  const run = randomUUID();
  const context = await browser.newContext({ timezoneId: AHEAD_OF_THE_SERVER });
  const page = await context.newPage();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    intoCash('2025-10-15', `A year before ${run}`, '2000'),
    intoCash('2026-10-01', `First of the month ${run}`, '1000'),
  ]);

  await page.clock.setFixedTime(new Date('2026-09-30T12:00:00Z'));
  await page.goto(TREND);

  await expect(rangeForm(page)).toBeVisible();
  await expectRange(page, '2025-11', '2026-10');
  await expectMonths(page, [...cashIn(monthsFrom('2025-11', 11), '2,000'), cash('2026-10', '3,000')]);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await page.clock.setFixedTime(new Date('2026-09-29T12:00:00Z'));
  await page.goto(TREND);

  await expectRange(page, '2025-10', '2026-09');
  await expectMonths(page, cashIn(monthsFrom('2025-10', 12), '2,000'));
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await context.close();
});

test('puts a range chosen with From month, To month and Show into the URL, which a reload and the back button keep', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `June ${run}`, '1000'), intoCash('2026-07-15', `July ${run}`, '2000')]);
  const juneToJuly = [cash('2026-06', '1,000'), cash('2026-07', '3,000')];
  const julyToAugust = [cash('2026-07', '3,000'), cash('2026-08', '3,000')];

  await fixToday(page, TODAY);
  await page.goto(TREND);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await showTrend(page, '2026-06', '2026-07');
  await expectShownRange(page, '2026-06', '2026-07');
  await expectMonths(page, juneToJuly);

  await showTrend(page, '2026-07', '2026-08');
  await expectShownRange(page, '2026-07', '2026-08');
  await expectMonths(page, julyToAugust);

  await page.goBack();
  await expectShownRange(page, '2026-06', '2026-07');
  await expectMonths(page, juneToJuly);

  await page.reload();
  await expectShownRange(page, '2026-06', '2026-07');
  await expectMonths(page, juneToJuly);
});

test('shows a range of a single month, and a range reaching into future months with the Entries already recorded there', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Now ${run}`, '1000'), intoCash('2027-01-15', `Ahead ${run}`, '5000')]);
  await fixToday(page, TODAY);

  await page.goto(ranged('2026-06', '2026-06'));
  await expectRange(page, '2026-06', '2026-06');
  await expectMonths(page, [cash('2026-06', '1,000')]);

  await page.goto(ranged('2026-11', '2027-02'));
  await expectRange(page, '2026-11', '2027-02');
  await expectMonths(page, [
    cash('2026-11', '1,000'),
    cash('2026-12', '1,000'),
    cash('2027-01', '6,000'),
    cash('2027-02', '6,000'),
  ]);
});

test('shows every month of a 600-month range, one point each', async ({ page }) => {
  const months = monthsFrom('1980-01', MOST_MONTHS);
  expect(months.at(-1)).toBe('2029-12');
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);

  await page.goto(ranged('1980-01', '2029-12'));

  await expectRange(page, '1980-01', '2029-12');
  await expect(trendChart(page)).toBeVisible();
  await expect(trendTable(page).getByRole('rowheader')).toHaveText(months.map(monthLabel));
  for (const [month, amount] of [
    ['1980-01', '0'],
    ['2026-05', '0'],
    ['2026-06', '1,000'],
    ['2029-12', '1,000'],
  ] as const) {
    await expect(monthCells(page, month)).toHaveText([amount, '0', amount]);
  }
});

test('refuses a malformed, empty, repeated, reversed or over-600-month range in the URL, or only one of From and To, explains itself, and shows no chart', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await page.goto(ranged('2026-06', '2026-06'));
  await expectMonths(page, [cash('2026-06', '1,000')]);

  for (const query of [
    'from=2026-6&to=2026-07',
    'from=2026-01&to=2026-13',
    'from=2026-06-01&to=2026-06-30',
    'from=&to=2026-06',
    'from=2026-06&to=',
    'from=2026-06&from=2026-07&to=2026-08',
    'from=2026-06&to=2026-07&to=2026-08',
    'from=2026-07&to=2026-06',
    'from=1980-01&to=2030-01',
    'from=2026-06',
    'to=2026-06',
  ]) {
    await page.goto(`${TREND}?${query}`);
    await expectRefused(page);
  }
});

test('refuses a From month later than its To month chosen with Show, explains itself, and shows no chart', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await page.goto(TREND);
  await showTrend(page, '2026-06', '2026-07');
  await expectMonths(page, [cash('2026-06', '1,000'), cash('2026-07', '1,000')]);

  await showTrend(page, '2026-07', '2026-06');

  await expectRefused(page);
});

test("shows an error and no chart when the browser's read of the default range fails, and shows the chart once Show is pressed again", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await fixToday(page, TODAY);
  await abortServerActions(page, TREND);

  await page.goto(TREND);

  await expectRange(page, '2025-10', '2026-09');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expectNoTrend(page);

  await page.unrouteAll({ behavior: 'wait' });
  await showButton(page).click();

  await expectShownRange(page, '2025-10', '2026-09');
  await expectMonths(page, cashFrom(monthsFrom('2025-10', 12), '2026-06', '1,000'));
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('fills From month and To month from a Year, Quarter or Month preset and shows that range at once, with it in the URL', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2025-12-31', `Year end ${randomUUID()}`, '1000')]);
  await page.setViewportSize(WIDE);
  await fixToday(page, TODAY);
  await page.goto(TREND);

  await choosePreset(page, 'Year', '2025');
  await expectShownRange(page, '2025-01', '2025-12');
  await expectMonths(page, cashFrom(monthsFrom('2025-01', 12), '2025-12', '1,000'));

  await choosePreset(page, 'Quarter', 'Q2 2026');
  await expectShownRange(page, '2026-04', '2026-06');
  await expectMonths(page, cashIn(monthsFrom('2026-04', 3), '1,000'));

  await choosePreset(page, 'Month', 'Jun 2026');
  await expectShownRange(page, '2026-06', '2026-06');
  await expectMonths(page, [cash('2026-06', '1,000')]);
});

test('offers Relative presets of the last, next and around 3, 6, 12, 24 and 36 months, the last and next counting the current month and around reaching that far on each side of it, and shows the range chosen at once', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-08-15', `August ${randomUUID()}`, '1000')]);
  await page.setViewportSize(WIDE);
  await fixToday(page, TODAY);
  await page.goto(TREND);

  await category(page, 'Relative').click();
  for (const name of RELATIVE_CHOICES) {
    await expect(presetChoice(page, name)).toBeVisible();
  }
  for (const absent of ['Last 1 month', 'Next 1 month', `${PLUS_MINUS}1 month`]) {
    await expect(presetChoice(page, absent)).toHaveCount(0);
  }

  await presetChoice(page, 'Last 12 months').click();
  await expectShownRange(page, '2025-10', '2026-09');
  await expectMonths(page, cashFrom(monthsFrom('2025-10', 12), '2026-08', '1,000'));

  await choosePreset(page, 'Relative', 'Next 3 months');
  await expectShownRange(page, '2026-09', '2026-11');
  await expectMonths(page, cashIn(monthsFrom('2026-09', 3), '1,000'));

  await choosePreset(page, 'Relative', `${PLUS_MINUS}3 months`);
  await expectShownRange(page, '2026-06', '2026-12');
  await expectMonths(page, cashFrom(monthsFrom('2026-06', 7), '2026-08', '1,000'));

  await choosePreset(page, 'Relative', 'Last 36 months');
  await expectShownRange(page, '2023-10', '2026-09');
  await expectMonths(page, cashFrom(monthsFrom('2023-10', 36), '2026-08', '1,000'));
});

test('opens the presets at 390px from Choose a period, as a full-screen sheet, and shows the range chosen there', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
  await page.setViewportSize(PHONE);
  await fixToday(page, TODAY);
  await page.goto(TREND);

  await expect(rangeForm(page)).toBeVisible();
  await expect(datePresets(page)).toBeHidden();

  await choosePeriod(page).click();
  const sheet = periodSheet(page);
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.x ?? Number.NaN).toBeCloseTo(0, 0);
  expect(box?.y ?? Number.NaN).toBeCloseTo(0, 0);
  expect(box?.width ?? Number.NaN).toBeCloseTo(PHONE.width, 0);
  expect(box?.height ?? Number.NaN).toBeCloseTo(PHONE.height, 0);

  const tabs = sheet.getByRole('tablist');
  await tabs.getByRole('tab', { name: 'Relative', exact: true }).click();
  await expect(presetChoice(sheet, 'Last 36 months')).toBeVisible();
  await tabs.getByRole('tab', { name: 'Month', exact: true }).click();
  await presetChoice(sheet, 'Jun 2026').click();

  await expect(sheet).toBeHidden();
  await expectShownRange(page, '2026-06', '2026-06');
  await expectMonths(page, [cash('2026-06', '1,000')]);
});

test('says nothing is recorded yet, in place of the chart and legend, when no shown Entry is dated on or before the last month, and draws the chart when every Entry predates the range', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(ranged('2026-06', '2026-08'));
  await expectNothingRecorded(page);

  await postEntries(page, [intoCash('2026-12-15', `Later ${run}`, '1000')]);
  await page.goto(ranged('2026-06', '2026-08'));
  await expectNothingRecorded(page);

  await page.goto(ranged('2026-11', '2026-12'));
  await expectMonths(page, [cash('2026-11', '0'), cash('2026-12', '1,000')]);

  await postEntries(page, [intoCash('2026-01-15', `Earlier ${run}`, '2000')]);
  await page.goto(ranged('2026-06', '2026-08'));
  await expectMonths(page, cashIn(monthsFrom('2026-06', 3), '2,000'));
});

test("counts no other User's Accounts or Entries in a User's trend", async ({ browser }) => {
  test.slow();
  const run = randomUUID();
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage, { accountsStartOn: BOOKS_OPEN });
  await postEntries(ownerPage, [
    intoCash(IN_JUNE, `Private cash ${run}`, '1000'),
    entryOn(IN_JUNE, `Private debt ${run}`, 'Food', 'Credit card payable', '2000'),
  ]);
  await ownerPage.goto(ranged('2026-06', '2026-06'));
  await expectMonths(ownerPage, [['2026-06', '1,000', '2,000', '-1,000']]);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, { accountsStartOn: BOOKS_OPEN });
  await otherPage.goto(ranged('2026-06', '2026-06'));
  await expectNothingRecorded(otherPage);

  await postEntries(otherPage, [intoCash(IN_JUNE, `Own cash ${run}`, '500')]);
  await otherPage.goto(ranged('2026-06', '2026-06'));
  await expectMonths(otherPage, [cash('2026-06', '500')]);

  await owner.close();
  await other.close();
});

test('sends a signed-out visitor to sign in, and back to the trend for the range they asked for once signed in', async ({ page }) => {
  await page.goto(ranged('2026-06', '2026-08'));
  await expect(page).toHaveURL(SIGN_IN_URL);

  await submitTestSignIn(page, freshIdentifier(), BOOKS_OPEN);

  await expectShownRange(page, '2026-06', '2026-08');
  await expectNothingRecorded(page);
});

test('sends a signed-out visitor who asked for no range to sign in, and back to the trend with no range once signed in', async ({ page }) => {
  await page.goto(TREND);
  await expect(page).toHaveURL(withQuery('/sign-in', { returnTo: TREND }));

  await submitTestSignIn(page, freshIdentifier(), BOOKS_OPEN);

  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);
  await expect(rangeForm(page)).toBeVisible();
});

test('links to the Assets and liabilities trend from the Sidebar of every signed-in page, after Assets and liabilities and before Settings', async ({ page }) => {
  await signIn(page);

  for (const path of [...SIGNED_IN_PAGES, INCOME_STATEMENT_PATH, ASSETS_AND_LIABILITIES_PATH, TREND]) {
    await page.goto(path);
    await expect(sidebar(page).getByRole('link')).toHaveText([...SIDEBAR_LINKS]);
  }

  await page.goto('/entries');
  await trendLink(page).click();
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);
  await expect(rangeForm(page)).toBeVisible();
  await expect(trendLink(page)).toHaveAttribute('aria-current', 'page');
  await expect(linkTo(sidebar(page), ASSETS_AND_LIABILITIES_PATH)).not.toHaveAttribute('aria-current', 'page');
});

test('links to the Assets and liabilities trend from the drawer behind Menu at 390px', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await menu(page).click();
  await trendLink(page).click();

  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);
  await expect(rangeForm(page)).toBeVisible();
});

test('names the Assets and liabilities trend by exactly one level-1 heading on a wide window and at 390px, and titles it before Credebi', async ({ page }) => {
  await signIn(page);

  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto(TREND);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Assets and liabilities trend', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  }
  await expect(page).toHaveTitle(pageTitle('Assets and liabilities trend'));
});

for (const language of ['ko', 'ja'] as const) {
  test(`shows the Assets and liabilities trend in ${language} when that is the User's Language: its heading, title, Sidebar link, inputs, presets, legend, table, tooltip and refusal`, async ({ page }) => {
    const { script, pageName, lines, categories } = TRANSLATIONS[language];
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    await postEntries(page, [intoCash(IN_JUNE, `Paid in ${randomUUID()}`, '1000')]);
    await page.goto(SETTINGS_PATH);
    await languageChoice(page, 'en', language).check();
    await expectSettingsPageIn(page, language);
    await page.setViewportSize(WIDE);

    await page.goto(ranged('2026-06', '2026-07'));

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageName);
    await expect(page).toHaveTitle(pageTitle(pageName));
    await expect(trendLinkIn(page.getByRole('navigation', { name: script }))).toHaveText(pageName);

    const form = page.getByRole('main').getByRole('form');
    await expect(form).toHaveAccessibleName(script);
    for (const field of ['from', 'to']) {
      await expect(form.locator(`input[name="${field}"]`)).toHaveAccessibleName(script);
      await expect(form.locator(`input[name="${field}"]`)).not.toHaveAccessibleName(/month/i);
    }
    for (const name of categories) {
      await expect(page.getByRole('main').getByRole('button', { name, exact: true })).toBeVisible();
    }

    for (const name of lines) {
      await expect(page.getByRole('main').getByRole('button', { name, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    for (const line of TREND_LINES) {
      await expect(legendItem(page, line)).toHaveCount(0);
    }
    const [netWorth, totalAssets, totalLiabilities] = lines;
    await expect(trendTable(page).getByRole('columnheader')).toHaveText([
      script,
      totalAssets,
      totalLiabilities,
      netWorth,
    ]);

    await tabTo(page, trendChart(page));
    const tooltip = trendTooltip(page);
    await expect(tooltip).toContainText(netWorth);
    await expect(tooltip).toContainText(totalAssets);
    await expect(tooltip).toContainText(totalLiabilities);
    await expect(tooltip).not.toContainText(/Net worth|Total assets|Total liabilities/);

    await page.goto(ranged('2026-07', '2026-06'));
    const refusal = page.getByRole('main').getByRole('alert');
    await expect(refusal).toHaveText(script);
    await expect(refusal).not.toContainText(/month/i);
    await expectNoTrend(page);
  });
}

test('fits the chart, its legend and the range form within the screen at 390px, with no horizontal scroll', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash(IN_JUNE, `Saved up ${randomUUID()}`, '1234567')]);
  await page.setViewportSize(PHONE);

  await page.goto(ranged('2025-07', '2026-06'));

  await expectMonths(page, cashFrom(monthsFrom('2025-07', 12), '2026-06', '1,234,567'));
  await expectWithinPhone(page, trendChart(page));
  await expectWithinPhone(page, rangeForm(page));
  for (const line of TREND_LINES) {
    await expectWithinPhone(page, legendItem(page, line));
  }
});

test('renders the Assets and liabilities trend page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(TREND);

  await expect(rangeForm(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Assets and liabilities trend', exact: true })).toBeVisible();
});
