import { randomUUID } from 'node:crypto';
import { type Locator, type Page } from '@playwright/test';
import { activeFrom, activeUntil, openAdd, openEdit } from './accounts';
import { reportDate } from './assets-and-liabilities';
import { DAY, listedEntry, openEditEntry, openEntryForm, postEntries, twoLine } from './entries';
import { fromField, toField } from './entry-search';
import { periodFrom, periodTo } from './income-statement';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH, INCOME_STATEMENT_PATH, SETTINGS_PATH } from './routes';

export type DayField = {
  readonly name: string;
  readonly open: (page: Page) => Promise<Locator>;
};

export const DAY_FIELDS: readonly DayField[] = [
  {
    name: 'the entry form Date',
    open: async (page: Page): Promise<Locator> => (await openEntryForm(page, 'Two-line mode')).getByLabel('Date', { exact: true }),
  },
  {
    name: 'Edit entry Date',
    open: async (page: Page): Promise<Locator> => {
      const memo = `Dated ${randomUUID()}`;
      await postEntries(page, [twoLine({ day: DAY, memo })]);
      const dialog = await openEditEntry(listedEntry(page, memo));
      return dialog.getByLabel('Date', { exact: true });
    },
  },
  {
    name: 'Entry search From',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(ENTRY_SEARCH_PATH);
      return fromField(page);
    },
  },
  {
    name: 'Entry search To',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(ENTRY_SEARCH_PATH);
      return toField(page);
    },
  },
  {
    name: 'Income statement From',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(INCOME_STATEMENT_PATH);
      return periodFrom(page);
    },
  },
  {
    name: 'Income statement To',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(INCOME_STATEMENT_PATH);
      return periodTo(page);
    },
  },
  {
    name: 'the Assets and liabilities day',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(ASSETS_AND_LIABILITIES_PATH);
      return reportDate(page);
    },
  },
  {
    name: 'Add account Active from',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(SETTINGS_PATH);
      return activeFrom(await openAdd(page, 'Assets', 'account'));
    },
  },
  {
    name: 'Add account Active until',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(SETTINGS_PATH);
      return activeUntil(await openAdd(page, 'Assets', 'account'));
    },
  },
  {
    name: 'Edit account Active from',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(SETTINGS_PATH);
      return activeFrom(await openEdit(page, 'Assets', 'Cash'));
    },
  },
  {
    name: 'Edit account Active until',
    open: async (page: Page): Promise<Locator> => {
      await page.goto(SETTINGS_PATH);
      return activeUntil(await openEdit(page, 'Assets', 'Cash'));
    },
  },
];
