import { expect, type Locator, type Page } from '@playwright/test';
import { gridMonth } from './assets-and-liabilities-trend';
import { type Language } from './language';

export const CHOSEN_FILL = 'rgb(219, 243, 235)';

export const previousMonth = (page: Page): Locator =>
  page.getByRole('button', { name: 'Previous month', exact: true });

export const nextMonth = (page: Page): Locator => page.getByRole('button', { name: 'Next month', exact: true });

export const dayPicker = (page: Page): Locator =>
  page.locator('*').filter({ has: previousMonth(page) }).filter({ has: nextMonth(page) }).last();

export const dayCell = (page: Page, day: number): Locator =>
  dayPicker(page)
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${String(day)}$`) });

export const dayCells = (page: Page): Locator =>
  dayPicker(page)
    .getByRole('button')
    .filter({ hasText: /^\d{1,2}$/ });

export const monthHeading = (page: Page, month: string): Locator =>
  dayPicker(page).getByRole('button').filter({ hasText: month });

export const pickerSheet = (page: Page): Locator => page.getByRole('dialog').filter({ has: previousMonth(page) });

export async function expectPickerOn(page: Page, month: string, focusedDay: number): Promise<void> {
  await expect(monthHeading(page, month)).toBeVisible();
  await expect(dayCell(page, focusedDay)).toBeFocused();
}

export async function expectPickerClosed(page: Page): Promise<void> {
  await expect(previousMonth(page)).toHaveCount(0);
  await expect(nextMonth(page)).toHaveCount(0);
  await expect(gridMonth(page, 'Jan 2026')).toHaveCount(0);
}

export async function weekdayHeaders(page: Page): Promise<readonly string[]> {
  const names = dayPicker(page).getByText(/^\p{L}+$/u);
  const shown = await names.count();
  const headers = await Promise.all(
    Array.from({ length: shown }, async (_, index) => ({
      text: (await names.nth(index).textContent()) ?? '',
      x: (await names.nth(index).boundingBox())?.x ?? Number.NaN,
    })),
  );
  return headers.sort((first, second) => first.x - second.x).map(({ text }) => text.trim());
}

const named = (points: readonly number[]): readonly string[] => points.map((point) => String.fromCodePoint(point));

export const SUNDAY_FIRST: Readonly<Record<Language, readonly string[]>> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  ko: named([0xc77c, 0xc6d4, 0xd654, 0xc218, 0xbaa9, 0xae08, 0xd1a0]),
  ja: named([0x65e5, 0x6708, 0x706b, 0x6c34, 0x6728, 0x91d1, 0x571f]),
};
