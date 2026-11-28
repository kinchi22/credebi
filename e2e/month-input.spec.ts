import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import {
  cash,
  chooseMonth,
  expectMonthFields,
  expectMonths,
  fromMonth,
  monthFields,
  showButton,
  toMonth,
  trendRangePath,
} from './assets-and-liabilities-trend';
import { fixToday } from './date-presets';
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
import { documentLanguage } from './language';
import { atRange, useLanguage } from './month-input';
import { TREND_PATH as TREND } from './routes';
import { signIn } from './session';
import { PHONE, WIDE } from './viewport';

const TODAY = '2026-09-15';

const LANGUAGES = ['en', 'ko', 'ja'] as const;

const valueMissing = (field: Locator): Promise<boolean> =>
  field.evaluate((input: { readonly validity: { readonly valueMissing: boolean } }) => input.validity.valueMissing);

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

    await expectRefusedAs(from, language, INVALID_MONTH, 'YYYYMM');
    await expect(from).toHaveValue('2026');
    await expect(page).toHaveURL(atRange('2026-06', '2026-07'));
  });
}

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

    await expectRefusedAs(fromMonth(page), 'en', INVALID_MONTH, 'YYYYMM');
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

    await expectRefusedAs(fromMonth(page), 'en', INVALID_MONTH, 'YYYYMM');
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

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('requests the numeric keypad for From month and To month', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);
    await page.goto(trendRangePath('2026-06', '2026-11'));

    await expect(fromMonth(page)).toHaveAttribute('inputmode', 'numeric');
    await expect(toMonth(page)).toHaveAttribute('inputmode', 'numeric');
  });
});
