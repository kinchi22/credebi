import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import {
  cash,
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
  trendRangePath,
} from './assets-and-liabilities-trend';
import { fixToday } from './date-presets';
import { intoCash, postEntries } from './entries';
import { chooseLanguageAtSettings, documentLanguage, tabTo, type Language } from './language';
import {
  ASSETS_AND_LIABILITIES_PATH,
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH,
  TREND_PATH as TREND,
  TREND_WITHOUT_QUERY,
  withQuery,
} from './routes';
import { signIn } from './session';
import { buttonNames, expectGridYear, expectYearButtons, GRID_TEXT, MONTH_NUMBERS } from './month-grid';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const TODAY = '2026-09-15';

const INVALID_MONTH = 'Enter a month as YYYY/MM';

const POPOVER_GAP = 24;

const SHEET_TOLERANCE = 2;

const LANGUAGES = ['en', 'ko', 'ja'] as const;

const atRange = (from: string, to: string): ((url: URL) => boolean) => withQuery(TREND, { from, to });

async function useLanguage(page: Page, language: Language): Promise<void> {
  if (language !== 'en') await chooseLanguageAtSettings(page, language);
}

async function expectGridClosed(page: Page, year: number): Promise<void> {
  await expect(rangeForm(page)).toBeVisible();
  for (const number of MONTH_NUMBERS) {
    await expect(gridMonth(page, GRID_TEXT.en.name(year, number))).toHaveCount(0);
  }
}

const valueMissing = (field: Locator): Promise<boolean> =>
  field.evaluate((input: { readonly validity: { readonly valueMissing: boolean } }) => input.validity.valueMissing);

const validationMessage = (field: Locator): Promise<string> =>
  field.evaluate((input: { readonly validationMessage: string }) => input.validationMessage);

async function expectInvalidMonth(field: Locator, language: Language): Promise<void> {
  const { script } = GRID_TEXT[language];
  if (script === undefined) {
    await expect(field).toHaveJSProperty('validationMessage', INVALID_MONTH);
    return;
  }
  await expect.poll(() => validationMessage(field)).toMatch(script);
  const message = await validationMessage(field);
  expect(message).toContain('YYYY/MM');
  expect(message).not.toContain(INVALID_MONTH);
}

for (const language of LANGUAGES) {
  test(`shows From month and To month as YYYY/MM in ${language}, for a range in the URL and for the twelve months it opens on`, async ({ page }) => {
    await signIn(page);
    await useLanguage(page, language);
    await fixToday(page, TODAY);

    await page.goto(trendRangePath('2026-06', '2026-11'));

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '2026/06', '2026/11');

    await page.goto(TREND);

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '2025/10', '2026/09');
  });

  test(`refuses a month not typed as YYYY/MM, saying so in ${language}`, async ({ page }) => {
    await signIn(page);
    await useLanguage(page, language);
    await page.goto(trendRangePath('2026-06', '2026-07'));
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '2026/06', '2026/07');

    const from = monthFields(page).nth(0);
    await from.fill('June 2026');
    await page.keyboard.press('Tab');
    await expect(from).not.toBeFocused();
    await from.press('Enter');

    await expectInvalidMonth(from, language);
    await expect(from).toHaveValue('June 2026');
    await expect(page).toHaveURL(atRange('2026-06', '2026-07'));
  });

  test(`shows the month grid in ${language}: its button, its year header and year buttons, its twelve months and each month's full name`, async ({ page }) => {
    const { script, name } = GRID_TEXT[language];
    await signIn(page);
    await useLanguage(page, language);
    await page.setViewportSize(WIDE);
    await page.goto(trendRangePath('2026-06', '2026-11'));
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);

    await tabTo(page, monthFields(page).nth(0));
    await page.keyboard.press('Tab');
    const trigger = page.getByRole('main').getByRole('form').getByRole('button').and(page.locator(':focus'));
    await expect(trigger).toHaveCount(1);
    if (script === undefined) {
      await expect(trigger).toHaveAccessibleName('Choose month');
    } else {
      await expect(trigger).toHaveAccessibleName(script);
    }
    const before = await buttonNames(page);

    await page.keyboard.press('Enter');

    await expectGridYear(page, language, 2026);
    await expectYearButtons(page, language, 2026, before);


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

  await expect(page).toHaveURL(atRange('2025-02', '2026-04'));
  await expectMonthFields(page, '2025/02', '2026/04');
  await expectMonths(
    page,
    monthsFrom('2025-02', 15).map((month) => cash(month, month < '2026-03' ? '1,000' : '3,000')),
  );
});

test("opens the month grid on today's year, focused on today's month, when its field is empty, and never on focusing the field", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await fixToday(page, TODAY);
  await page.goto(trendRangePath('2024-03', '2024-05'));
  await expectMonthFields(page, '2024/03', '2024/05');

  await fromMonth(page).click();
  await expect(fromMonth(page)).toBeFocused();
  await expectGridClosed(page, 2024);

  await fromMonth(page).fill('');
  await chooseMonth(page, 'From').click();

  await expectGridYear(page, 'en', 2026);
  await expect(gridMonth(page, 'Sep 2026')).toBeFocused();
});

test('works the month grid by keyboard: arrows move across months, PageUp moves to the next year and PageDown to the previous, Enter and Space pick, Escape closes back to its button', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Nov 2026')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(gridMonth(page, 'Dec 2026')).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(gridMonth(page, 'Dec 2027')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(gridMonth(page, 'Nov 2027')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(toMonth(page)).toHaveValue('2027/11');
  await expectGridClosed(page, 2027);
  await expect(page).toHaveURL(atRange('2026-06', '2026-11'));

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Nov 2027')).toBeFocused();
  await page.keyboard.press('PageDown');
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
  await page.goto(trendRangePath('2026-06', '2026-07'));
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

  await expect(page).toHaveURL(atRange('2026-09', '2026-11'));
  await expectMonthFields(page, '2026/09', '2026/11');
  await expectMonths(page, monthsFrom('2026-09', 3).map((month) => cash(month, '1,000')));
});

test('keeps anything else typed as it is, and refuses to show it, saying to enter a month as YYYY/MM, and still refuses an empty field', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-06-15', `June ${randomUUID()}`, '1000')]);
  await page.goto(trendRangePath('2026-06', '2026-07'));
  await expectMonths(page, [cash('2026-06', '1,000'), cash('2026-07', '1,000')]);

  for (const typed of ['June 2026', '2026/13', '26/06', '2026-06-15']) {
    await fromMonth(page).fill(typed);
    await page.keyboard.press('Tab');
    await expect(fromMonth(page)).toHaveValue(typed);

    await showButton(page).click();

    await expectInvalidMonth(fromMonth(page), 'en');
    await expect(page).toHaveURL(atRange('2026-06', '2026-07'));
    await expect(fromMonth(page)).toHaveValue(typed);
  }

  await fromMonth(page).fill('');
  await page.keyboard.press('Tab');
  await showButton(page).click();

  await expect.poll(() => valueMissing(fromMonth(page))).toBe(true);
  await expect(page).toHaveURL(atRange('2026-06', '2026-07'));
});

test('opens the month grid on a wide window in a popover starting just under its field', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'From').click();

  await expectGridYear(page, 'en', 2026);
  const field = await fromMonth(page).boundingBox();
  const fieldBottom = (field?.y ?? Number.NaN) + (field?.height ?? Number.NaN);
  const tops = await Promise.all(
    [gridMonth(page, 'Jan 2026'), page.getByRole('button', { name: 'Previous year', exact: true })].map(
      async (part) => (await part.boundingBox())?.y ?? Number.NaN,
    ),
  );
  const gap = Math.min(...tops) - fieldBottom;
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(POPOVER_GAP);
});

test('opens the month grid at 390px in a bottom sheet within the screen, and closes it on picking a month', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '2026/06', '2026/11');

  await chooseMonth(page, 'From').click();

  const sheet = page.getByRole('dialog').filter({ has: gridMonth(page, 'Jun 2026') });
  await expect(sheet).toBeVisible();
  await expectWithinPhone(page, sheet);
  const box = await sheet.boundingBox();
  const bottom = (box?.y ?? Number.NaN) + (box?.height ?? Number.NaN);
  expect(Math.abs(bottom - PHONE.height)).toBeLessThanOrEqual(SHEET_TOLERANCE);

  await gridMonth(page, 'Mar 2026').click();

  await expect(sheet).toBeHidden();
  await expectMonthFields(page, '2026/03', '2026/11');
  await expect(page).toHaveURL(atRange('2026-06', '2026-11'));
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
      await expect(main.getByLabel(label, { exact: true })).toHaveAttribute('type', 'date');
    }
    await expect(main.getByRole('button', { name: 'Choose month', exact: true })).toHaveCount(0);
  }
});
