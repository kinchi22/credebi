import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { accountsSection } from './accounts';
import { reportDate, reportDateForm, reportTable, showReport } from './assets-and-liabilities';
import {
  expectRange,
  nothingRecorded,
  rangeForm,
  showTrend,
  trendChart,
  trendRangePath,
} from './assets-and-liabilities-trend';
import { entries, entryForm, entryOn, entrySearchForm, listedEntry, postEntries } from './entries';
import { fromField, resultFor, results, toField } from './entry-search';
import { expectPeriod, periodForm, showStatement, statementTable } from './income-statement';
import { languageChoices } from './language';
import { reportRow } from './report-tables';
import {
  ASSETS_AND_LIABILITIES_PATH,
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  TREND_PATH,
} from './routes';
import { type FaultSection } from './section-faults';
import { BOOKS_OPEN, signIn } from './session';
import { connectionsSection, entryFormModes } from './settings';

export type Seeded = {
  readonly memoA: string;
  readonly memoB: string;
};

export const FIGURE_A = '11,111';

export const FIGURE_B = '22,222';

export const FIGURE_B_CUMULATIVE = '33,333';

const DAY_A = '2026-05-10';

const DAY_B = '2026-06-10';

export async function signInWithSeededEntries(page: Page): Promise<Seeded> {
  const run = randomUUID();
  const memoA = `Earlier ${run}`;
  const memoB = `Later ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    entryOn(DAY_A, memoA, 'Cash', 'Salary', '11111'),
    entryOn(DAY_B, memoB, 'Cash', 'Salary', '22222'),
  ]);
  return { memoA, memoB };
}

export type SectionView = {
  readonly id: FaultSection;
  readonly content: (page: Page, seeded: Seeded) => Locator;
  readonly controls?: (page: Page) => Locator;
  readonly frame?: (page: Page) => Locator;
  readonly empty?: (page: Page) => Locator;
};

export type Filter = {
  readonly apply: (page: Page) => Promise<void>;
  readonly expectTyped: (page: Page) => Promise<void>;
  readonly figure: (seeded: Seeded) => string;
  readonly path: string;
};

export type PageView = {
  readonly name: string;
  readonly path: string;
  readonly heading: string;
  readonly form?: (page: Page) => Locator;
  readonly sections: readonly SectionView[];
  readonly filters?: {
    readonly quiet: Filter;
    readonly first: Filter;
    readonly second: Filter;
  };
  readonly pathWithoutQuery?: string;
};

const firstControl = (scope: Locator): Locator => scope.locator('input, button, select, textarea').first();

const statementFilter = (from: string, to: string, figure: string): Filter => ({
  path: `${INCOME_STATEMENT_PATH}?from=${from}&to=${to}`,
  apply: (page) => showStatement(page, from, to),
  expectTyped: (page) => expectPeriod(page, from, to),
  figure: () => figure,
});

const reportFilter = (day: string, figure: string): Filter => ({
  path: `${ASSETS_AND_LIABILITIES_PATH}?date=${day}`,
  apply: (page) => showReport(page, day),
  expectTyped: (page) => expect(reportDate(page)).toHaveValue(day),
  figure: () => figure,
});

const trendFilter = (from: string, to: string, figure: string): Filter => ({
  path: trendRangePath(from, to),
  apply: (page) => showTrend(page, from, to),
  expectTyped: (page) => expectRange(page, from, to),
  figure: () => figure,
});

const searchFilter = (from: string, to: string, memo: (seeded: Seeded) => string): Filter => ({
  path: `${ENTRY_SEARCH_PATH}?from=${from}&to=${to}`,
  apply: async (page) => {
    await expect(entrySearchForm(page)).toBeVisible();
    await fromField(page).fill(from);
    await toField(page).fill(to);
    await entrySearchForm(page).getByRole('button', { name: 'Search', exact: true }).click();
  },
  expectTyped: async (page) => {
    await expect(fromField(page)).toHaveValue(from);
    await expect(toField(page)).toHaveValue(to);
  },
  figure: memo,
});

export const ENTRIES_PAGE: PageView = {
  name: 'Entries',
  path: '/entries',
  heading: 'Entries',
  sections: [
    {
      id: 'entries.form',
      content: (page) => entryForm(page),
      controls: (page) => firstControl(entryForm(page)),
      frame: (page) => entryForm(page),
    },
    {
      id: 'entries.list',
      content: (page, seeded) => listedEntry(page, seeded.memoB),
      controls: (page) => entries(page).getByRole('button', { name: 'Edit', exact: true }).first(),
      empty: (page) => page.getByText('No entries yet.', { exact: true }),
    },
  ],
};

export const SETTINGS_PAGE: PageView = {
  name: 'Settings',
  path: SETTINGS_PATH,
  heading: 'Settings',
  sections: [
    {
      id: 'settings.entry-form-mode',
      content: (page) => entryFormModes(page),
      controls: (page) => entryFormModes(page).getByRole('radio').first(),
      frame: (page) => entryFormModes(page),
    },
    {
      id: 'settings.accounts',
      content: (page) => accountsSection(page),
      controls: (page) => firstControl(accountsSection(page)),
    },
    {
      id: 'settings.language',
      content: (page) => languageChoices(page, 'en'),
      controls: (page) => languageChoices(page, 'en').getByRole('radio').first(),
      frame: (page) => languageChoices(page, 'en'),
    },
    {
      id: 'settings.connections',
      content: (page) => connectionsSection(page),
      controls: (page) => connectionsSection(page).getByRole('button', { name: 'Start connecting', exact: true }),
      empty: (page) => connectionsSection(page).getByText('An AI application reads your books and posts entries.'),
    },
  ],
};

export const INCOME_STATEMENT_PAGE: PageView = {
  name: 'Income statement',
  path: statementFilter('2026-06-01', '2026-06-30', FIGURE_B).path,
  pathWithoutQuery: INCOME_STATEMENT_PATH,
  heading: 'Income statement',
  form: periodForm,
  sections: [
    {
      id: 'income-statement.report',
      content: (page) => statementTable(page, 'Totals'),
      empty: (page) => reportRow(statementTable(page, 'Totals'), 'Net income').getByRole('cell').filter({ hasText: /^0$/ }),
    },
  ],
  filters: {
    quiet: statementFilter('2026-01-01', '2026-01-31', '0'),
    first: statementFilter('2026-05-01', '2026-05-31', FIGURE_A),
    second: statementFilter('2026-06-01', '2026-06-30', FIGURE_B),
  },
};

export const ASSETS_AND_LIABILITIES_PAGE: PageView = {
  name: 'Assets and liabilities',
  path: reportFilter('2026-06-30', FIGURE_B_CUMULATIVE).path,
  pathWithoutQuery: ASSETS_AND_LIABILITIES_PATH,
  heading: 'Assets and liabilities',
  form: reportDateForm,
  sections: [
    {
      id: 'assets-and-liabilities.report',
      content: (page) => reportTable(page, 'Totals'),
      empty: (page) => reportRow(reportTable(page, 'Totals'), 'Net worth').getByRole('cell').filter({ hasText: /^0$/ }),
    },
  ],
  filters: {
    quiet: reportFilter('2026-01-31', '0'),
    first: reportFilter('2026-05-31', FIGURE_A),
    second: reportFilter('2026-06-30', FIGURE_B_CUMULATIVE),
  },
};

export const TREND_PAGE: PageView = {
  name: 'Assets and liabilities trend',
  path: trendFilter('2026-06', '2026-06', FIGURE_B_CUMULATIVE).path,
  pathWithoutQuery: TREND_PATH,
  heading: 'Assets and liabilities trend',
  form: rangeForm,
  sections: [
    {
      id: 'assets-and-liabilities-trend.chart',
      content: (page) => trendChart(page),
      empty: (page) => nothingRecorded(page),
    },
  ],
  filters: {
    quiet: trendFilter('2026-01', '2026-01', '0'),
    first: trendFilter('2026-04', '2026-05', FIGURE_A),
    second: trendFilter('2026-06', '2026-06', FIGURE_B_CUMULATIVE),
  },
};

export const ENTRY_SEARCH_PAGE: PageView = {
  name: 'Entry search',
  path: searchFilter('2026-06-01', '2026-06-30', (seeded) => seeded.memoB).path,
  pathWithoutQuery: ENTRY_SEARCH_PATH,
  heading: 'Entry search',
  form: entrySearchForm,
  sections: [
    {
      id: 'entry-search.results',
      content: (page, seeded) => resultFor(page, seeded.memoB),
      empty: (page) => results(page).getByText('Nothing matched what you asked for.', { exact: true }),
    },
  ],
  filters: {
    quiet: searchFilter('2026-01-01', '2026-01-31', () => 'Nothing matched what you asked for.'),
    first: searchFilter('2026-05-01', '2026-05-31', (seeded) => seeded.memoA),
    second: searchFilter('2026-06-01', '2026-06-30', (seeded) => seeded.memoB),
  },
};

export const PAGES: readonly PageView[] = [
  ENTRIES_PAGE,
  ENTRY_SEARCH_PAGE,
  SETTINGS_PAGE,
  INCOME_STATEMENT_PAGE,
  ASSETS_AND_LIABILITIES_PAGE,
  TREND_PAGE,
];

export const REPORT_PAGES: readonly PageView[] = PAGES.filter((view) => view.filters !== undefined);

export const heading = (page: Page, view: PageView): Locator =>
  page.getByRole('heading', { level: 1, name: view.heading, exact: true });

export async function expectShell(page: Page, view: PageView): Promise<void> {
  await expect(heading(page, view)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
  if (view.form !== undefined) await expect(view.form(page)).toBeVisible();
}

export const resultText = (page: Page): Locator => page.getByRole('main');
