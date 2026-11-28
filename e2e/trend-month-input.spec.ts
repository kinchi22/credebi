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
import { choosePeriod, fixToday } from './date-presets';
import {
  caretAt,
  expectInsideFrame,
  expectRefusedAs,
  INVALID_MONTH,
  MONTH_PLACEHOLDER,
  placeCaret,
  selectDigits,
  validationMessage,
} from './day-input';
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

const expectInvalidMonth = (field: Locator, language: Language): Promise<void> =>
  expectRefusedAs(field, language, INVALID_MONTH, 'YYYYMM');

for (const language of LANGUAGES) {
  test(`shows From month and To month as YYYYMM in ${language}, for a range in the URL and for the twelve months it opens on`, async ({ page }) => {
    await signIn(page);
    await useLanguage(page, language);
    await fixToday(page, TODAY);

    await page.goto(trendRangePath('2026-06', '2026-11'));

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '202606', '202611');

    await page.goto(TREND);

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '202510', '202609');
  });

  test(`refuses an incomplete month on submit, saying to enter a month as YYYYMM in ${language}`, async ({ page }) => {
    await signIn(page);
    await useLanguage(page, language);
    await page.goto(trendRangePath('2026-06', '2026-07'));
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expectMonthFields(page, '202606', '202607');

    const from = monthFields(page).nth(0);
    await from.fill('2026');
    await from.press('Enter');

    await expectInvalidMonth(from, language);
    await expect(from).toHaveValue('2026');
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

    await expectMonthFields(page, '202603', '202611');
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
  await expectMonthFields(page, '202510', '202609');

  await chooseMonth(page, 'From').click();
  await expectGridYear(page, 'en', 2025);
  await page.getByRole('button', { name: 'Previous year', exact: true }).click();
  await expectGridYear(page, 'en', 2024);
  await page.getByRole('button', { name: 'Next year', exact: true }).click();
  await expectGridYear(page, 'en', 2025);
  await gridMonth(page, 'Feb 2025').click();

  await expect(fromMonth(page)).toHaveValue('202502');
  await expectGridClosed(page, 2025);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await chooseMonth(page, 'To').click();
  await expectGridYear(page, 'en', 2026);
  await gridMonth(page, 'Apr 2026').click();

  await expect(toMonth(page)).toHaveValue('202604');
  await expectGridClosed(page, 2026);
  await expect(page).toHaveURL(TREND_WITHOUT_QUERY);

  await showButton(page).click();

  await expect(page).toHaveURL(atRange('2025-02', '2026-04'));
  await expectMonthFields(page, '202502', '202604');
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
  await expectMonthFields(page, '202403', '202405');

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
  await expectMonthFields(page, '202606', '202611');

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

  await expect(toMonth(page)).toHaveValue('202711');
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

  await expect(toMonth(page)).toHaveValue('202610');
  await expectGridClosed(page, 2026);

  await chooseMonth(page, 'To').focus();
  await page.keyboard.press('Enter');
  await expect(gridMonth(page, 'Oct 2026')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');

  await expectGridClosed(page, 2026);
  await expect(chooseMonth(page, 'To')).toBeFocused();
  await expect(toMonth(page)).toHaveValue('202610');
});

test('refuses an unpadded month such as 2026-9 or 2026/1 as incomplete rather than guessing it', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-09-15', `September ${randomUUID()}`, '1000')]);
  await page.goto(trendRangePath('2026-06', '2026-07'));
  await expectMonthFields(page, '202606', '202607');

  for (const [typed, held] of [
    ['2026-9', '20269'],
    ['2026/1', '20261'],
    ['2026.1', '20261'],
  ] as const) {
    await fromMonth(page).fill(typed);
    await expect(fromMonth(page)).toHaveValue(held);

    await showButton(page).click();

    await expectInvalidMonth(fromMonth(page), 'en');
    await expect(page).toHaveURL(atRange('2026-06', '2026-07'));
  }
});

test('refuses a month that is incomplete or does not exist on submit, keeping what was typed, and still refuses an empty field', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [intoCash('2026-06-15', `June ${randomUUID()}`, '1000')]);
  await page.goto(trendRangePath('2026-06', '2026-07'));
  await expectMonths(page, [cash('2026-06', '1,000'), cash('2026-07', '1,000')]);

  for (const typed of ['2026', '20260', '202613', '202600', '000001', '999913', '202699']) {
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

test('accepts the first and the last month the app can hold, 000101 and 999912, and a month typed as 202607', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(trendRangePath('2026-06', '2026-07'));
  await expectMonthFields(page, '202606', '202607');

  await fromMonth(page).fill('202607');
  await toMonth(page).fill('202608');
  await showButton(page).click();
  await expect(page).toHaveURL(atRange('2026-07', '2026-08'));

  await fromMonth(page).fill('000101');
  await expect.poll(() => validationMessage(fromMonth(page))).toBe('');
  await toMonth(page).fill('999912');
  await expect.poll(() => validationMessage(toMonth(page))).toBe('');
});

test('opens the month grid on a wide window in a popover starting just under its field', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '202606', '202611');

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
  await expectMonthFields(page, '202606', '202611');

  await chooseMonth(page, 'From').click();

  const sheet = page.getByRole('dialog').filter({ has: gridMonth(page, 'Jun 2026') });
  await expect(sheet).toBeVisible();
  await expectWithinPhone(page, sheet);
  const box = await sheet.boundingBox();
  const bottom = (box?.y ?? Number.NaN) + (box?.height ?? Number.NaN);
  expect(Math.abs(bottom - PHONE.height)).toBeLessThanOrEqual(SHEET_TOLERANCE);

  await gridMonth(page, 'Mar 2026').click();

  await expect(sheet).toBeHidden();
  await expectMonthFields(page, '202603', '202611');
  await expect(page).toHaveURL(atRange('2026-06', '2026-11'));
});

test('gives the day fields of the other pages a Choose date button, and no Choose month button', async ({ page }) => {
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
      await expect(main.getByLabel(label, { exact: true })).not.toHaveAttribute('type', 'date');
    }
    await expect(main.getByRole('button', { name: 'Choose date', exact: true })).toHaveCount(labels.length);
    await expect(main.getByRole('button', { name: 'Choose month', exact: true })).toHaveCount(0);
  }
});

test('keeps only digits, at most six, as they are typed into From month and To month', async ({ page }) => {
  await signIn(page);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '202606', '202611');

  for (const field of [fromMonth(page), toMonth(page)]) {
    await field.fill('');
    await field.pressSequentially('2a0-2/6.1 x1y5999');
    await expect(field).toHaveValue('202611');
  }
});

test('reduces a compact, slash, hyphen or dot month set at once to its first six digits', async ({ page }) => {
  await signIn(page);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '202606', '202611');

  for (const text of ['202611', '2026/11', '2026-11', '2026.11', '2026-11-25', '2026-11 and 99']) {
    await toMonth(page).fill(text);
    await expect(toMonth(page)).toHaveValue('202611');
  }
});

test('replaces the digits a selection covers in a month, keeps the caret in place on an edit in the middle, and ignores non-digit keystrokes', async ({ page }) => {
  await signIn(page);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  const field = toMonth(page);
  await field.fill('202611');
  await field.focus();

  await selectDigits(field, 0, 4);
  await page.keyboard.type('1999');
  await expect(field).toHaveValue('199911');

  await placeCaret(field, 4);
  await page.keyboard.press('Backspace');
  await expect(field).toHaveValue('19911');
  expect(await caretAt(field)).toEqual([3, 3]);
  await page.keyboard.type('9');
  await expect(field).toHaveValue('199911');
  expect(await caretAt(field)).toEqual([4, 4]);

  await page.keyboard.type('x');
  await page.keyboard.type('/');
  await expect(field).toHaveValue('199911');
  expect(await caretAt(field)).toEqual([4, 4]);
});

test('shows YYYYMM in an empty From month and To month, with the calendar button inside the field', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(WIDE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '202606', '202611');

  await fromMonth(page).fill('');
  await toMonth(page).fill('');

  await expect(fromMonth(page)).toHaveAttribute('placeholder', MONTH_PLACEHOLDER);
  await expect(toMonth(page)).toHaveAttribute('placeholder', MONTH_PLACEHOLDER);
  await expectInsideFrame(fromMonth(page), chooseMonth(page, 'From'));
  await expectInsideFrame(toMonth(page), chooseMonth(page, 'To'));
});

test('requests the numeric keypad for From month and To month', { tag: '@webkit' }, async ({ page }) => {
  await signIn(page);
  await page.goto(trendRangePath('2026-06', '2026-11'));

  await expect(fromMonth(page)).toHaveAttribute('inputmode', 'numeric');
  await expect(toMonth(page)).toHaveAttribute('inputmode', 'numeric');
});

test('shows a bolt, not a calendar, on Choose a period below the wide width, and keeps the calendar on each field', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto(trendRangePath('2026-06', '2026-11'));
  await expectMonthFields(page, '202606', '202611');

  const period = choosePeriod(page);
  await expect(period).toBeVisible();
  await expect(period.locator('svg')).toHaveCount(1);
  await expect(period.locator('svg rect')).toHaveCount(0);
  const field = chooseMonth(page, 'From');
  await expect(field.locator('svg rect')).toHaveCount(1);
  const [boltDrawing, calendarDrawing] = await Promise.all([
    period.locator('svg').innerHTML(),
    field.locator('svg').innerHTML(),
  ]);
  expect(boltDrawing).not.toBe(calendarDrawing);
});
