import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openAdd, openEdit, activeFrom, activeUntil, BOOKS_OPEN } from './accounts';
import { reportDate } from './assets-and-liabilities';
import { DAY, listedEntry, openEditEntry, openEntryForm, postEntries, twoLine } from './entries';
import { fromField, toField } from './entry-search';
import { periodFrom, periodTo } from './income-statement';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH, INCOME_STATEMENT_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';

type DateField = {
  readonly name: string;
  readonly open: (page: Page) => Promise<Locator>;
};

const FIELDS: readonly DateField[] = [
  {
    name: 'the entry form Date',
    open: async (page) => (await openEntryForm(page, 'Two-line mode')).getByLabel('Date', { exact: true }),
  },
  {
    name: 'Edit entry Date',
    open: async (page) => {
      const memo = `Dated ${randomUUID()}`;
      await postEntries(page, [twoLine({ day: DAY, memo })]);
      const dialog = await openEditEntry(listedEntry(page, memo));
      return dialog.getByLabel('Date', { exact: true });
    },
  },
  {
    name: 'Entry search From',
    open: async (page) => {
      await page.goto(ENTRY_SEARCH_PATH);
      return fromField(page);
    },
  },
  {
    name: 'Entry search To',
    open: async (page) => {
      await page.goto(ENTRY_SEARCH_PATH);
      return toField(page);
    },
  },
  {
    name: 'Income statement From',
    open: async (page) => {
      await page.goto(INCOME_STATEMENT_PATH);
      return periodFrom(page);
    },
  },
  {
    name: 'Income statement To',
    open: async (page) => {
      await page.goto(INCOME_STATEMENT_PATH);
      return periodTo(page);
    },
  },
  {
    name: 'the Assets and liabilities day',
    open: async (page) => {
      await page.goto(ASSETS_AND_LIABILITIES_PATH);
      return reportDate(page);
    },
  },
  {
    name: 'Add account Active from',
    open: async (page) => {
      await page.goto(SETTINGS_PATH);
      return activeFrom(await openAdd(page, 'Assets', 'account'));
    },
  },
  {
    name: 'Add account Active until',
    open: async (page) => {
      await page.goto(SETTINGS_PATH);
      return activeUntil(await openAdd(page, 'Assets', 'account'));
    },
  },
  {
    name: 'Edit account Active from',
    open: async (page) => {
      await page.goto(SETTINGS_PATH);
      return activeFrom(await openEdit(page, 'Assets', 'Cash'));
    },
  },
  {
    name: 'Edit account Active until',
    open: async (page) => {
      await page.goto(SETTINGS_PATH);
      return activeUntil(await openEdit(page, 'Assets', 'Cash'));
    },
  },
];

const FIRST_SEGMENT = { position: { x: 20, y: 10 } } as const;

async function fillAndPlaceCaret(page: Page, field: Locator, day: string): Promise<boolean> {
  await field.fill(DAY);
  await field.click(FIRST_SEGMENT);
  await page.keyboard.press('ArrowUp');
  const yearFirst = (await field.inputValue()).startsWith('2027');
  await field.fill(day);
  await field.click(FIRST_SEGMENT);
  return yearFirst;
}

async function typeYear(page: Page, field: Locator, filled: string, digits: string): Promise<void> {
  if (!(await fillAndPlaceCaret(page, field, filled))) {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.type(digits);
}

test.beforeEach(async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
});

for (const { name, open } of FIELDS) {
  test(`keeps four digits when six are typed into the year of ${name}`, async ({ page }) => {
    const field = await open(page);

    await typeYear(page, field, '2019-09-15', '202612');

    await expect(field).toHaveValue(/^2026-\d{2}-\d{2}$/);
  });

  test(`replaces a filled year of ${name} when four new digits are typed`, async ({ page }) => {
    const field = await open(page);

    await typeYear(page, field, DAY, '2031');

    await expect(field).toHaveValue(`2031${DAY.slice(4)}`);
  });
}
