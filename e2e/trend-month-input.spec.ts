import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import {
  chooseMonth,
  expectMonthFields,
  expectMonths,
  fromMonth,
  gridMonth,
  monthFields,
  monthsFrom,
  rangeForm,
  showButton,
  toMonth,
  type TrendMonth,
} from './assets-and-liabilities-trend';
import { fixToday } from './date-presets';
import { entryOn, postEntries, type TwoLineEntry } from './entries';
import { documentLanguage, expectSettingsPageIn, languageChoice, tabTo, type Language } from './language';
import {
  ASSETS_AND_LIABILITIES_PATH,
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  TREND_PATH as TREND,
  TREND_WITHOUT_QUERY,
  withQuery,
} from './routes';
import { signIn } from './session';
import { HANGUL } from './typed-text';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const TODAY = '2026-09-15';

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

type GridText = {
  readonly script: RegExp | undefined;
  readonly month: (month: number) => string;
  readonly name: (year: number, month: number) => string;
};

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const GRID_TEXT: Readonly<Record<Language, GridText>> = {
  en: {
    script: undefined,
    month: (month) => EN_MONTHS[month - 1] ?? '',
    name: (year, month) => `${EN_MONTHS[month - 1] ?? ''} ${String(year)}`,
  },
  ko: {
    script: HANGUL,
    month: (month) => `${String(month)}\uC6D4`,
    name: (year, month) => `${String(year)}\uB144 ${String(month)}\uC6D4`,
  },
  ja: {
    script: JAPANESE,
    month: (month) => `${String(month)}\u6708`,
    name: (year, month) => `${String(year)}\u5E74${String(month)}\u6708`,
  },
};

const LANGUAGES = ['en', 'ko', 'ja'] as const;

const ranged = (from: string, to: string): string => `${TREND}?from=${from}&to=${to}`;

const intoCash = (day: string, memo: string, amount: string): TwoLineEntry =>
  entryOn(day, memo, 'Cash', 'Opening balance equity', amount);

const cash = (month: string, amount: string): TrendMonth => [month, amount, '0', amount];

const focused = (page: Page): Locator => page.locator(':focus');

async function useLanguage(page: Page, language: Language): Promise<void> {
  if (language === 'en') return;
  await page.goto(SETTINGS_PATH);
  await languageChoice(page, 'en', language).check();
  await expectSettingsPageIn(page, language);
}

async function expectGridYear(page: Page, language: Language, year: number): Promise<void> {
  const { month, name } = GRID_TEXT[language];
  for (const number of MONTH_NUMBERS) {
    await expect(gridMonth(page, name(year, number))).toHaveText(month(number));
  }
}

async function expectGridClosed(page: Page, year: number): Promise<void> {
  await expect(rangeForm(page)).toBeVisible();
  for (const number of MONTH_NUMBERS) {
    await expect(gridMonth(page, GRID_TEXT.en.name(year, number))).toHaveCount(0);
  }
}

for (const language of LANGUAGES) {
  test(`shows From month and To month as YYYY/MM in ${language}, for a range in the URL and for the twelve months it opens on`, async ({ page }) => {
    await signIn(page);
    await useLanguage(page, language);
    await fixToday(page, TODAY);

    await page.goto(ranged('2026-06', '2026-11'));

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '2026/06', '2026/11');

    await page.goto(TREND);

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '2025/10', '2026/09');
  });

  test(`shows the month grid in ${language}: its button, its twelve months and each month's full name`, async ({ page }) => {
    const { script, name } = GRID_TEXT[language];
    await signIn(page);
    await useLanguage(page, language);
    await page.setViewportSize(WIDE);
    await page.goto(ranged('2026-06', '2026-11'));
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);

    const from = monthFields(page).nth(0);
    await tabTo(page, from);
    await page.keyboard.press('Tab');
    const trigger = focused(page);
    await expect(trigger).toHaveRole('button');
    if (script === undefined) {
      await expect(trigger).toHaveAccessibleName('Choose month');
    } else {
      await expect(trigger).toHaveAccessibleName(script);
      await expect(trigger).not.toHaveAccessibleName(/month/i);
    }

    await page.keyboard.press('Enter');

    await expectGridYear(page, language, 2026);
    if (script !== undefined) {
      const main = page.getByRole('main');
      await expect(main.getByRole('button', { name: /^(?:Previous year|Next year|Choose month)$/ })).toHaveCount(0);
      await expect(main.getByRole('button', { name: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/ })).toHaveCount(0);
    }

    await gridMonth(page, name(2026, 3)).click();

    await expectMonthFields(page, '2026/03', '2026/11');
    await expect(gridMonth(page, name(2026, 3))).toHaveCount(0);
  });
}

test('fills From month and To month from the month grid without showing the range, and shows the trend of the months chosen once Show is pressed', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2025-02-15', `February ${run}`, '1000'), intoCash('2026-03-15', `March ${run}`, '2000')]);
  await page.setViewportSize(WIDE);
  await fixToday(page, TODAY);
  await page.goto(TREND);
  await expectMonthFields(page, '2025/10', '2026/09');

  await chooseMonth(page, 'From').click();
  await expectGridYear(page, 'en', 2025);
  await page.getByRole('button', { name: 'Previous year', exact: true }).click();
  await expectGridYear(page, 'en', 2024);
  await page.getByRole('button', { name: 'Next year', exact: true }).click();
  await expectGridYear(page, 'en', 2025);
  await gridMonth(page, 'Feb 2025').click();

  await expect(fromMonth(page)).toHaveValue('2025/02');
  await expectGridClosed(page, 2025);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await chooseMonth(page, 'To').click();
  await expectGridYear(page, 'en', 2026);
  await gridMonth(page, 'Apr 2026').click();

  await expect(toMonth(page)).toHaveValue('2026/04');
  await expectGridClosed(page, 2026);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await showButton(page).click();

  await expect(page).toHaveURL(withQuery(TREND, { from: '2025-02', to: '2026-04' }));
  await expectMonthFields(page, '2025/02', '2026/04');
  await expectMonths(
    page,
    monthsFrom('2025-02', 15).map((month) => cash(month, month < '2026-03' ? '1,000' : '3,000')),
  );
});

test("opens the month grid on today's year when its field is empty, and never on focusing the field", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await fixToday(page, TODAY);
  await page.goto(ranged('2024-03', '2024-05'));
  await expectMonthFields(page, '2024/03', '2024/05');

  await fromMonth(page).click();
  await expect(fromMonth(page)).toBeFocused();
  await expectGridClosed(page, 2024);

  await fromMonth(page).fill('');
  await chooseMonth(page, 'From').click();

  await expectGridYear(page, 'en', 2026);
});

test('works the month grid by keyboard: arrows move across months, PageUp and PageDown change the year, Enter and Space pick, Escape closes back to its button', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(ranged('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Nov 2026')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(gridMonth(page, 'Dec 2026')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(gridMonth(page, 'Dec 2027')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(gridMonth(page, 'Nov 2027')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(toMonth(page)).toHaveValue('2027/11');
  await expectGridClosed(page, 2027);
  await expect(page).toHaveURL(withQuery(TREND, { from: '2026-06', to: '2026-11' }));

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Nov 2027')).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(gridMonth(page, 'Nov 2026')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(gridMonth(page, 'Oct 2026')).toBeFocused();
  await page.keyboard.press('Space');

  await expect(toMonth(page)).toHaveValue('2026/10');
  await expectGridClosed(page, 2026);

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Oct 2026')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');

  await expectGridClosed(page, 2026);
  await expect(chooseMonth(page, 'To')).toBeFocused();
  await expect(toMonth(page)).toHaveValue('2026/10');
});

test('turns a typed 2026-1, 2026/1, 2026-11 or 2026/11 into YYYY/MM on leaving the field, and shows that range on Show', async ({ page }) => {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-01-15', `January ${run}`, '1000')]);
  await page.goto(ranged('2026-06', '2026-07'));
  await expectMonthFields(page, '2026/06', '2026/07');

  for (const [typed, shown] of [
    ['2026-1', '2026/01'],
    ['2026/1', '2026/01'],
    ['2026-11', '2026/11'],
    ['2026/11', '2026/11'],
  ] as const) {
    await toMonth(page).fill(typed);
    await page.keyboard.press('Tab');
    await expect(toMonth(page)).toHaveValue(shown);
  }
  await fromMonth(page).fill('2026-9');
  await page.keyboard.press('Tab');
  await expect(fromMonth(page)).toHaveValue('2026/09');

  await showButton(page).click();

  await expect(page).toHaveURL(withQuery(TREND, { from: '2026-09', to: '2026-11' }));
  await expectMonthFields(page, '2026/09', '2026/11');
  await expectMonths(page, monthsFrom('2026-09', 3).map((month) => cash(month, '1,000')));
});

test('keeps anything else typed as it is, and refuses to show it, saying to enter a month as YYYY/MM', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-06-15', `June ${randomUUID()}`, '1000')]);
  await page.goto(ranged('2026-06', '2026-07'));
  await expectMonths(page, [cash('2026-06', '1,000'), cash('2026-07', '1,000')]);

  for (const typed of ['June 2026', '2026/13', '26/06', '2026-06-15']) {
    await fromMonth(page).fill(typed);
    await page.keyboard.press('Tab');
    await expect(fromMonth(page)).toHaveValue(typed);

    await showButton(page).click();

    await expect(fromMonth(page)).toHaveJSProperty('validationMessage', 'Enter a month as YYYY/MM');
    await expect(page).toHaveURL(withQuery(TREND, { from: '2026-06', to: '2026-07' }));
    await expect(fromMonth(page)).toHaveValue(typed);
  }
});

test('opens the month grid in a popover under its field on a wide window', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(ranged('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'From').click();

  const field = await fromMonth(page).boundingBox();
  const january = await gridMonth(page, 'Jan 2026').boundingBox();
  expect(january?.y ?? Number.NaN).toBeGreaterThanOrEqual((field?.y ?? Number.NaN) + (field?.height ?? Number.NaN));
});

test('opens the month grid at 390px in a bottom sheet within the screen, and closes it on picking a month', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto(ranged('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'From').click();

  const sheet = page.getByRole('dialog').filter({ has: gridMonth(page, 'Jun 2026') });
  await expect(sheet).toBeVisible();
  await expectWithinPhone(page, sheet);
  const box = await sheet.boundingBox();
  expect((box?.y ?? Number.NaN) + (box?.height ?? Number.NaN)).toBeCloseTo(PHONE.height, 0);

  await gridMonth(page, 'Mar 2026').click();

  await expect(sheet).toBeHidden();
  await expectMonthFields(page, '2026/03', '2026/11');
  await expect(page).toHaveURL(withQuery(TREND, { from: '2026-06', to: '2026-11' }));
});

test('leaves the day fields of the other pages as native date inputs with no month grid', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);

  for (const [path, labels] of [
    [INCOME_STATEMENT_PATH, ['From', 'To']],
    [ENTRY_SEARCH_PATH, ['From', 'To']],
    [ASSETS_AND_LIABILITIES_PATH, ['Date']],
  ] as const) {
    await page.goto(path);
    const main = page.getByRole('main');
    for (const label of labels) {
      const field = main.getByLabel(label, { exact: true });
      await expect(field).toHaveAttribute('type', 'date');
    }
    await expect(main.getByRole('button', { name: 'Choose month', exact: true })).toHaveCount(0);
  }
});
