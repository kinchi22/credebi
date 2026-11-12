import { expect, type Locator, type Page } from '@playwright/test';
import { gridMonth, monthLabel, monthsFrom, MONTH_NAMES } from './assets-and-liabilities-trend';
import { type Language } from './language';
import { HANGUL, JAPANESE } from './typed-text';

export const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

export const ENGLISH_GRID = new RegExp(
  `^(?:Choose month|Previous year|Next year)$|\\b(?:${MONTH_NAMES.join('|')})\\b`,
);

const BUTTON_LINE = /^\s*- button "((?:[^"\\]|\\.)*)"/gm;

export type GridText = {
  readonly script: RegExp | undefined;
  readonly month: (month: number) => string;
  readonly name: (year: number, month: number) => string;
  readonly year: (year: number) => RegExp;
};

const monthOf = (year: number, month: number): string => monthsFrom(`${String(year)}-01`, month).at(-1) ?? '';

const shownYear = (suffix: string) => (year: number): RegExp =>
  new RegExp(`^\\s*${String(year)}\\s*${suffix}\\s*$`);

export const GRID_TEXT: Readonly<Record<Language, GridText>> = {
  en: {
    script: undefined,
    month: (month) => MONTH_NAMES[month - 1] ?? '',
    name: (year, month) => monthLabel(monthOf(year, month)),
    year: shownYear(''),
  },
  ko: {
    script: HANGUL,
    month: (month) => `${String(month)}\uC6D4`,
    name: (year, month) => `${String(year)}\uB144 ${String(month)}\uC6D4`,
    year: shownYear('(?:\\uB144)?'),
  },
  ja: {
    script: JAPANESE,
    month: (month) => `${String(month)}\u6708`,
    name: (year, month) => `${String(year)}\u5E74${String(month)}\u6708`,
    year: shownYear('(?:\\u5E74)?'),
  },
};

export async function buttonNames(page: Page): Promise<string[]> {
  const snapshot = await page.locator('body').ariaSnapshot();
  return [...snapshot.matchAll(BUTTON_LINE)].map(([, name]) => String(JSON.parse(`"${name ?? ''}"`)));
}

const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

export const gridAround = (page: Page, month: string, yearButton: string): Locator =>
  page
    .locator('*')
    .filter({ has: button(page, month) })
    .filter({ has: button(page, yearButton) })
    .last();

export async function expectGridYear(page: Page, language: Language, year: number): Promise<void> {
  const { month, name } = GRID_TEXT[language];
  for (const number of MONTH_NUMBERS) {
    await expect(gridMonth(page, name(year, number))).toContainText(month(number));
  }
}

async function expectYearShown(page: Page, language: Language, year: number, yearButton: string): Promise<void> {
  const { name, year: shown } = GRID_TEXT[language];
  await expectGridYear(page, language, year);
  await expect(gridAround(page, name(year, 1), yearButton).getByText(shown(year))).toBeVisible();
}

export async function expectYearButtons(
  page: Page,
  language: Language,
  year: number,
  before: readonly string[],
): Promise<void> {
  const { script, name } = GRID_TEXT[language];
  const months = new Set(MONTH_NUMBERS.map((number) => name(year, number)));
  const yearButtons = (await buttonNames(page)).filter((shown) => !before.includes(shown) && !months.has(shown));
  expect(yearButtons, 'the grid adds a Previous year and a Next year button').toHaveLength(2);
  if (script === undefined) {
    expect([...yearButtons].sort()).toEqual(['Next year', 'Previous year']);
  } else {
    for (const shown of yearButtons) expect(shown).toMatch(script);
    await expect(page.getByRole('button', { name: ENGLISH_GRID })).toHaveCount(0);
  }

  const [first = '', second = ''] = yearButtons;
  await expectYearShown(page, language, year, first);

  await button(page, first).click();
  const earlier = gridMonth(page, name(year - 1, 1));
  await expect(earlier.or(gridMonth(page, name(year + 1, 1)))).toBeVisible();
  const moved = (await earlier.count()) > 0 ? year - 1 : year + 1;
  if (script === undefined) expect(moved).toBe(first === 'Previous year' ? year - 1 : year + 1);
  await expectYearShown(page, language, moved, first);

  await button(page, second).click();
  await expectYearShown(page, language, year, second);

  await button(page, second).click();
  await expectYearShown(page, language, 2 * year - moved, second);

  await button(page, first).click();
  await expectYearShown(page, language, year, first);
}
