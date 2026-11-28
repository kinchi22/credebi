import { expect, test, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { reportDate, reportDateForm, reportDatePickerButton } from './assets-and-liabilities';
import { gridMonth } from './assets-and-liabilities-trend';
import { fixToday } from './date-presets';
import { DAY_FIELDS } from './day-fields';
import { chooseDate, chooseDateOf } from './day-input';
import {
  SURFACE_CHOSEN,
  dayCell,
  dayCells,
  expectPickerClosed,
  expectPickerOn,
  monthHeading,
  nextMonth,
  pickerSheet,
  previousMonth,
  SUNDAY_FIRST,
  weekdayHeaders,
} from './day-picker';
import { chooseLanguageAtSettings, documentLanguage } from './language';
import { ASSETS_AND_LIABILITIES_PATH } from './routes';
import { signIn } from './session';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const TODAY = '2026-09-15';

const LANGUAGES = ['en', 'ko', 'ja'] as const;

const POPOVER_GAP = 24;

const SHEET_TOLERANCE = 2;

const REPORT_WITHOUT_QUERY = /\/assets-and-liabilities$/;

async function openReport(page: Page, day?: string): Promise<void> {
  await fixToday(page, TODAY);
  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await expect(reportDateForm(page)).toBeVisible();
  if (day !== undefined) await reportDate(page).fill(day);
}

async function openPicker(page: Page): Promise<void> {
  await chooseDate(reportDateForm(page)).click();
  await expect(previousMonth(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.setViewportSize(WIDE);
});

test('opens the day picker only when its in-field Choose date button is pressed, never on arriving at the page or focusing the field', async ({ page }) => {
  await openReport(page);
  await expectPickerClosed(page);

  await reportDate(page).click();
  await expect(reportDate(page)).toBeFocused();
  await reportDate(page).pressSequentially('2026');
  await expectPickerClosed(page);

  await openPicker(page);
  await expect(monthHeading(page, '2026/09')).toBeVisible();
});

test("opens on today's month, focused and marked on today, when the field holds no complete day", async ({ page }) => {
  for (const held of ['', '2026', '2026091', '20260230']) {
    await openReport(page, held);

    await openPicker(page);

    await expectPickerOn(page, '2026/09', 15);
    await expect(dayCell(page, 15)).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expectPickerClosed(page);
  }
});

test("opens on the field's month, focused on the chosen day, which is marked chosen apart from today", async ({ page }) => {
  await openReport(page, '20260920');

  await openPicker(page);

  await expectPickerOn(page, '2026/09', 20);
  await expect(dayCell(page, 20)).toHaveCSS('background-color', SURFACE_CHOSEN);
  await expect(dayCell(page, 15)).toHaveAttribute('aria-current', 'date');
  await expect(dayCell(page, 15)).not.toHaveCSS('background-color', SURFACE_CHOSEN);
  await expect(dayCell(page, 20)).not.toHaveAttribute('aria-current', 'date');
});

test('marks today and the chosen day on the same cell when they are one day', async ({ page }) => {
  await openReport(page, '20260915');

  await openPicker(page);

  await expectPickerOn(page, '2026/09', 15);
  await expect(dayCell(page, 15)).toHaveAttribute('aria-current', 'date');
  await expect(dayCell(page, 15)).toHaveCSS('background-color', SURFACE_CHOSEN);
});

test('marks no today in a month other than the current one', async ({ page }) => {
  await openReport(page, '20250304');

  await openPicker(page);

  await expectPickerOn(page, '2025/03', 4);
  await expect(dayCell(page, 4)).toHaveCSS('background-color', SURFACE_CHOSEN);
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
});

test('chooses a complete typed day when the picker opens, so that the field and the picker agree', async ({ page }) => {
  await openReport(page, '20260101');

  await openPicker(page);
  await expectPickerOn(page, '2026/01', 1);
  await page.keyboard.press('Escape');

  await reportDate(page).fill('20240229');
  await openPicker(page);
  await expectPickerOn(page, '2024/02', 29);
  await expect(dayCell(page, 29)).toHaveCSS('background-color', SURFACE_CHOSEN);
  await expect(reportDate(page)).toHaveValue('20240229');
});

test('shows a month as seven columns starting on Sunday, with its own days only and the neighbouring days left blank', async ({ page }) => {
  await openReport(page, '20260920');
  await openPicker(page);

  await expect(dayCells(page)).toHaveCount(30);
  await expect(dayCell(page, 31)).toHaveCount(0);
  const boxes = await Promise.all(
    Array.from({ length: 30 }, async (_, index) => (await dayCell(page, index + 1).boundingBox()) ?? { x: Number.NaN, y: Number.NaN }),
  );
  const columns = [...new Set(boxes.map(({ x }) => Math.round(x)))].sort((first, second) => first - second);
  expect(columns).toHaveLength(7);
  const column = (day: number): number => columns.indexOf(Math.round(boxes[day - 1]?.x ?? Number.NaN));
  expect(column(6), 'Sunday 6 September 2026 is in the first column').toBe(0);
  expect(column(1), 'Tuesday 1 September 2026 is in the third column').toBe(2);
  expect(column(5), 'Saturday 5 September 2026 is in the last column').toBe(6);
  expect(column(30), 'Wednesday 30 September 2026 is in the fourth column').toBe(3);
  const rowOf = (day: number): number => Math.round(boxes[day - 1]?.y ?? Number.NaN);
  expect(rowOf(1)).toBe(rowOf(5));
  expect(rowOf(6)).toBeGreaterThan(rowOf(5));
  expect(rowOf(13)).toBeGreaterThan(rowOf(6));
});

for (const language of LANGUAGES) {
  test(`heads the columns with weekday names in ${language}, Sunday first`, async ({ page }) => {
    if (language !== 'en') await chooseLanguageAtSettings(page, language);
    await openReport(page);
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await reportDatePickerButton(page).click();

    const expected = SUNDAY_FIRST[language];
    const headers = await weekdayHeaders(page, expected[0] ?? '');

    expect(headers).toHaveLength(7);
    for (const [index, first] of expected.entries()) {
      expect(headers[index]?.startsWith(first), `the header of column ${String(index + 1)} starts with ${first}`).toBe(true);
    }
  });
}

test('steps through the months with Previous month and Next month, across a year end', async ({ page }) => {
  await openReport(page, '20261215');
  await openPicker(page);
  await expect(monthHeading(page, '2026/12')).toBeVisible();

  await nextMonth(page).click();
  await expect(monthHeading(page, '2027/01')).toBeVisible();
  await expect(dayCells(page)).toHaveCount(31);

  await previousMonth(page).click();
  await previousMonth(page).click();
  await expect(monthHeading(page, '2026/11')).toBeVisible();
  await expect(dayCells(page)).toHaveCount(30);
});

test('shows the month grid when the heading is pressed, and returns to the day grid on the month picked there', async ({ page }) => {
  await openReport(page, '20260920');
  await openPicker(page);

  await monthHeading(page, '2026/09').click();

  await expect(gridMonth(page, 'Sep 2026')).toBeVisible();
  await expect(gridMonth(page, 'Mar 2026')).toBeVisible();
  await expect(dayCells(page)).toHaveCount(0);

  await gridMonth(page, 'Mar 2026').click();

  await expect(monthHeading(page, '2026/03')).toBeVisible();
  await expect(dayCells(page)).toHaveCount(31);
  await expect(gridMonth(page, 'Mar 2026')).toHaveCount(0);
  await expect(reportDate(page)).toHaveValue('20260920');

  await dayCell(page, 8).click();
  await expect(reportDate(page)).toHaveValue('20260308');
});

test('works the day grid by keyboard: arrows move a day and a week, Home and End to the start and end of the week, PageUp and PageDown a month, Shift with them a year', async ({ page }) => {
  await openReport(page);
  await openPicker(page);
  await expectPickerOn(page, '2026/09', 15);

  await page.keyboard.press('ArrowRight');
  await expectPickerOn(page, '2026/09', 16);
  await page.keyboard.press('ArrowLeft');
  await expectPickerOn(page, '2026/09', 15);
  await page.keyboard.press('ArrowDown');
  await expectPickerOn(page, '2026/09', 22);
  await page.keyboard.press('ArrowUp');
  await expectPickerOn(page, '2026/09', 15);

  await page.keyboard.press('Home');
  await expectPickerOn(page, '2026/09', 13);
  await page.keyboard.press('End');
  await expectPickerOn(page, '2026/09', 19);
  await page.keyboard.press('End');
  await expectPickerOn(page, '2026/09', 19);

  await page.keyboard.press('PageUp');
  await expectPickerOn(page, '2026/10', 19);
  await page.keyboard.press('PageDown');
  await expectPickerOn(page, '2026/09', 19);
  await page.keyboard.press('PageDown');
  await expectPickerOn(page, '2026/08', 19);
  await page.keyboard.press('PageUp');
  await expectPickerOn(page, '2026/09', 19);

  await page.keyboard.press('Shift+PageUp');
  await expectPickerOn(page, '2027/09', 19);
  await page.keyboard.press('Shift+PageDown');
  await expectPickerOn(page, '2026/09', 19);
  await page.keyboard.press('Shift+PageDown');
  await expectPickerOn(page, '2025/09', 19);
  await page.keyboard.press('Shift+PageUp');
  await expectPickerOn(page, '2026/09', 19);
});

test('moves on into the next or the previous month when an arrow passes the end or the start of the shown one', async ({ page }) => {
  await openReport(page, '20260930');
  await openPicker(page);
  await expectPickerOn(page, '2026/09', 30);

  await page.keyboard.press('ArrowRight');
  await expectPickerOn(page, '2026/10', 1);
  await page.keyboard.press('ArrowLeft');
  await expectPickerOn(page, '2026/09', 30);
  await page.keyboard.press('ArrowDown');
  await expectPickerOn(page, '2026/10', 7);
  await page.keyboard.press('ArrowUp');
  await expectPickerOn(page, '2026/09', 30);
});

test('picks the focused day with Enter or Space, filling the field, closing and returning focus to its button without submitting', async ({ page }) => {
  await openReport(page, '20260919');
  await openPicker(page);
  await expectPickerOn(page, '2026/09', 19);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20260920');
  await expect(chooseDate(reportDateForm(page))).toBeFocused();
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);

  await openPicker(page);
  await expectPickerOn(page, '2026/09', 20);
  await page.keyboard.press('PageUp');
  await page.keyboard.press('Space');

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20261020');
  await expect(chooseDate(reportDateForm(page))).toBeFocused();
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
});

test('picks a day by click, filling the field at once and closing without submitting the form', async ({ page }) => {
  await openReport(page);
  await openPicker(page);

  await dayCell(page, 3).click();

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20260903');
  await expect(chooseDate(reportDateForm(page))).toBeFocused();
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
});

test('closes on Escape, leaving the field as it was and focus on the Choose date button', async ({ page }) => {
  await openReport(page, '20260919');
  await openPicker(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('PageUp');

  await page.keyboard.press('Escape');

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20260919');
  await expect(chooseDate(reportDateForm(page))).toBeFocused();
});

test('closes on a click outside, leaving the field as it was', async ({ page }) => {
  await openReport(page, '20260919');
  await openPicker(page);

  await page.getByRole('heading', { level: 1 }).click();

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20260919');
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
});

test('closes when focus leaves it, leaving the field as it was', async ({ page }) => {
  await openReport(page, '20260919');
  await openPicker(page);

  await reportDateForm(page).getByRole('button', { name: 'Show', exact: true }).focus();

  await expectPickerClosed(page);
  await expect(reportDate(page)).toHaveValue('20260919');
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
});

test('stops at the first month, 0001/01, whatever way it is asked to go earlier', async ({ page }) => {
  await openReport(page, '00010101');
  await openPicker(page);
  await expectPickerOn(page, '0001/01', 1);

  for (const key of ['ArrowLeft', 'ArrowUp', 'PageDown', 'Shift+PageDown']) {
    await page.keyboard.press(key);
    await expectPickerOn(page, '0001/01', 1);
  }
  await previousMonth(page).click({ force: true });
  await expect(monthHeading(page, '0001/01')).toBeVisible();

  await page.keyboard.press('PageUp');
  await expect(monthHeading(page, '0001/02')).toBeVisible();
});

test('stops at the last month, 9999/12, whatever way it is asked to go later', async ({ page }) => {
  await openReport(page, '99991231');
  await openPicker(page);
  await expectPickerOn(page, '9999/12', 31);

  for (const key of ['ArrowRight', 'ArrowDown', 'PageUp', 'Shift+PageUp']) {
    await page.keyboard.press(key);
    await expectPickerOn(page, '9999/12', 31);
  }
  await nextMonth(page).click({ force: true });
  await expect(monthHeading(page, '9999/12')).toBeVisible();

  await page.keyboard.press('PageDown');
  await expect(monthHeading(page, '9999/11')).toBeVisible();
});

for (const { name, open } of DAY_FIELDS) {
  test(`picks a day into ${name}, from the Choose date button inside it`, async ({ page }) => {
    const field = await open(page);
    await field.fill('20260915');

    await chooseDateOf(field).click();
    await expect(monthHeading(page, '2026/09')).toBeVisible();
    await dayCell(page, 20).click();

    await expectPickerClosed(page);
    await expect(field).toHaveValue('20260920');
    await expect(chooseDateOf(field)).toBeFocused();
  });
}

test('opens the picker as a popover starting just under its field on a wide window', async ({ page }) => {
  await openReport(page, '20260920');

  await openPicker(page);

  const field = await reportDate(page).boundingBox();
  const fieldBottom = (field?.y ?? Number.NaN) + (field?.height ?? Number.NaN);
  const tops = await Promise.all(
    [monthHeading(page, '2026/09'), previousMonth(page), nextMonth(page)].map(
      async (part) => (await part.boundingBox())?.y ?? Number.NaN,
    ),
  );
  const gap = Math.min(...tops) - fieldBottom;
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(POPOVER_GAP);
  await expect(pickerSheet(page)).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('opens the picker at 390px as a modal sheet titled Choose date, within the screen and at the foot of the page', async ({ page }) => {
    await openReport(page, '20260920');

    await openPicker(page);

    const sheet = pickerSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await expectWithinPhone(page, sheet);
    const box = await sheet.boundingBox();
    const bottom = (box?.y ?? Number.NaN) + (box?.height ?? Number.NaN);
    expect(Math.abs(bottom - PHONE.height)).toBeLessThanOrEqual(SHEET_TOLERANCE);
    await expectPickerOn(page, '2026/09', 20);
  });

  test('picks a day in the sheet, closing it and filling the field', async ({ page }) => {
    await openReport(page, '20260920');
    await openPicker(page);

    await dayCell(page, 4).click();

    await expect(pickerSheet(page)).toBeHidden();
    await expect(reportDate(page)).toHaveValue('20260904');
    await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
  });

  test('closes the sheet with its close icon, leaving the field as it was', async ({ page }) => {
    await openReport(page, '20260920');
    await openPicker(page);

    await pickerSheet(page).getByRole('button', { name: 'Close', exact: true }).click();

    await expect(pickerSheet(page)).toBeHidden();
    await expect(reportDate(page)).toHaveValue('20260920');
    await expect(chooseDate(reportDateForm(page))).toBeFocused();
  });

  test('closes the sheet when the window grows to a wide one', async ({ page }) => {
    await openReport(page, '20260920');
    await openPicker(page);
    await expect(pickerSheet(page)).toBeVisible();

    await page.setViewportSize(WIDE);

    await expectPickerClosed(page);
    await expect(reportDate(page)).toHaveValue('20260920');
  });
});

test.describe('on a touch phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('opens the sheet when the Choose date button is tapped', { tag: '@webkit' }, async ({ page }) => {
    await openReport(page, '20260920');

    await chooseDate(reportDateForm(page)).tap();

    await expect(pickerSheet(page)).toBeVisible();
    await expect(monthHeading(page, '2026/09')).toBeVisible();

    await dayCell(page, 4).tap();

    await expect(pickerSheet(page)).toBeHidden();
    await expect(reportDate(page)).toHaveValue('20260904');
  });
});
