import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseMonth, trendRangePath } from './assets-and-liabilities-trend';
import { choosePeriod } from './date-presets';
import { chooseDate } from './day-input';
import { ENTRY_SEARCH_PATH, INCOME_STATEMENT_PATH } from './routes';
import { signIn } from './session';
import { PHONE } from './viewport';

const PAGES: readonly {
  readonly name: string;
  readonly path: string;
  readonly calendar: (page: Page) => Locator;
}[] = [
  {
    name: 'the Assets and liabilities trend',
    path: trendRangePath('2026-06', '2026-11'),
    calendar: (page) => chooseMonth(page, 'From'),
  },
  { name: 'Entry search', path: ENTRY_SEARCH_PATH, calendar: (page) => chooseDate(page.getByRole('main')) },
  {
    name: 'the Income statement',
    path: INCOME_STATEMENT_PATH,
    calendar: (page) => chooseDate(page.getByRole('main')),
  },
];

for (const { name, path, calendar } of PAGES) {
  test(`shows a bolt, not a calendar, on Choose a period below the wide width on ${name}, while a field keeps its calendar`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(PHONE);
    await page.goto(path);

    const period = choosePeriod(page);
    await expect(period).toBeVisible();
    await expect(period).toHaveAccessibleName('Choose a period');
    await expect(period.locator('svg')).toHaveCount(1);
    await expect(period.locator('svg rect')).toHaveCount(0);
    const field = calendar(page);
    await expect(field.locator('svg rect')).toHaveCount(1);
    const [boltDrawing, calendarDrawing] = await Promise.all([
      period.locator('svg').innerHTML(),
      field.locator('svg').innerHTML(),
    ]);
    expect(boltDrawing).not.toBe(calendarDrawing);
  });
}
