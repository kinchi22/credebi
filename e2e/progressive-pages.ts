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
import { fromField, resultFor, results, search, toField } from './entry-search';
import { expectPeriod, periodForm, showStatement, statementTable } from './income-statement';
import { languageChoices } from './language';
import {
  ASSETS_AND_LIABILITIES_PATH,
  ENTRY_SEARCH_PATH,
  INCOME_STATEMENT_PATH,
  SETTINGS_PATH,
  TREND_PATH,
} from './routes';
import { type FaultSection } from './section-faults';
import { BOOKS_OPEN, signIn } from './session';
import { connectionsSection, entryFormModes, startConnectingButton } from './settings';
import { sidebar } from './sidebar';

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
};

export type ReportPageView = PageView & {
  readonly form: (page: Page) => Locator;
  readonly report: SectionView;
  readonly pathWithoutQuery: string;
  readonly quietPath: string;
  readonly first: Filter;
  readonly second: Filter;
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
  apply: (page) => search(page, { from, to }),
  expectTyped: async (page) => {
    await expect(fromField(page)).toHaveValue(from);
    await expect(toField(page)).toHaveValue(to);
  },
  figure: memo,
});

const modeChoice = (page: Page): Locator => entryFormModes(page).getByRole('radio').first();

const languageChoice = (page: Page): Locator => languageChoices(page, 'en').getByRole('radio').first();

const ENTRIES_PAGE: PageView = {
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

const SETTINGS_PAGE: PageView = {
  name: 'Settings',
  path: SETTINGS_PATH,
  heading: 'Settings',
  sections: [
    {
      id: 'settings.entry-form-mode',
      content: modeChoice,
      controls: modeChoice,
      frame: (page) => entryFormModes(page),
    },
    {
      id: 'settings.accounts',
      content: (page) => accountsSection(page).getByRole('group').first(),
      controls: (page) => firstControl(accountsSection(page)),
    },
    {
      id: 'settings.language',
      content: languageChoice,
      controls: languageChoice,
      frame: (page) => languageChoices(page, 'en'),
    },
    {
      id: 'settings.connections',
      content: startConnectingButton,
      controls: startConnectingButton,
      empty: (page) => connectionsSection(page).getByText('An AI application reads your books and posts entries.'),
    },
  ],
};

const INCOME_STATEMENT_REPORT: SectionView = {
  id: 'income-statement.report',
  content: (page) => statementTable(page, 'Totals'),
};

const INCOME_STATEMENT_PAGE: ReportPageView = {
  name: 'Income statement',
  path: statementFilter('2026-06-01', '2026-06-30', FIGURE_B).path,
  pathWithoutQuery: INCOME_STATEMENT_PATH,
  quietPath: statementFilter('2026-01-01', '2026-01-31', '').path,
  heading: 'Income statement',
  form: periodForm,
  report: INCOME_STATEMENT_REPORT,
  sections: [INCOME_STATEMENT_REPORT],
  first: statementFilter('2026-05-01', '2026-05-31', FIGURE_A),
  second: statementFilter('2026-06-01', '2026-06-30', FIGURE_B),
};

const ASSETS_AND_LIABILITIES_REPORT: SectionView = {
  id: 'assets-and-liabilities.report',
  content: (page) => reportTable(page, 'Totals'),
};

const ASSETS_AND_LIABILITIES_PAGE: ReportPageView = {
  name: 'Assets and liabilities',
  path: reportFilter('2026-06-30', FIGURE_B_CUMULATIVE).path,
  pathWithoutQuery: ASSETS_AND_LIABILITIES_PATH,
  quietPath: reportFilter('2026-01-31', '').path,
  heading: 'Assets and liabilities',
  form: reportDateForm,
  report: ASSETS_AND_LIABILITIES_REPORT,
  sections: [ASSETS_AND_LIABILITIES_REPORT],
  first: reportFilter('2026-05-31', FIGURE_A),
  second: reportFilter('2026-06-30', FIGURE_B_CUMULATIVE),
};

const TREND_CHART: SectionView = {
  id: 'assets-and-liabilities-trend.chart',
  content: (page) => trendChart(page),
  empty: (page) => nothingRecorded(page),
};

const TREND_PAGE: ReportPageView = {
  name: 'Assets and liabilities trend',
  path: trendFilter('2026-06', '2026-06', FIGURE_B_CUMULATIVE).path,
  pathWithoutQuery: TREND_PATH,
  quietPath: trendFilter('2026-01', '2026-01', '').path,
  heading: 'Assets and liabilities trend',
  form: rangeForm,
  report: TREND_CHART,
  sections: [TREND_CHART],
  first: trendFilter('2026-04', '2026-05', FIGURE_A),
  second: trendFilter('2026-06', '2026-06', FIGURE_B_CUMULATIVE),
};

const ENTRY_SEARCH_RESULTS: SectionView = {
  id: 'entry-search.results',
  content: (page, seeded) => resultFor(page, seeded.memoB),
  empty: (page) => results(page).getByText('Nothing matched what you asked for.', { exact: true }),
};

const ENTRY_SEARCH_PAGE: ReportPageView = {
  name: 'Entry search',
  path: searchFilter('2026-06-01', '2026-06-30', (seeded) => seeded.memoB).path,
  pathWithoutQuery: ENTRY_SEARCH_PATH,
  quietPath: searchFilter('2026-01-01', '2026-01-31', () => '').path,
  heading: 'Entry search',
  form: entrySearchForm,
  report: ENTRY_SEARCH_RESULTS,
  sections: [ENTRY_SEARCH_RESULTS],
  first: searchFilter('2026-05-01', '2026-05-31', (seeded) => seeded.memoA),
  second: searchFilter('2026-06-01', '2026-06-30', (seeded) => seeded.memoB),
};

export const REPORT_PAGES: readonly ReportPageView[] = [
  ENTRY_SEARCH_PAGE,
  INCOME_STATEMENT_PAGE,
  ASSETS_AND_LIABILITIES_PAGE,
  TREND_PAGE,
];

export const PAGES: readonly PageView[] = [ENTRIES_PAGE, SETTINGS_PAGE, ...REPORT_PAGES];

export const heading = (page: Page, view: PageView): Locator =>
  page.getByRole('heading', { level: 1, name: view.heading, exact: true });

export async function expectShell(page: Page, view: PageView): Promise<void> {
  await expect(heading(page, view)).toBeVisible();
  await expect(sidebar(page)).toBeVisible();
  if (view.form !== undefined) await expect(view.form(page)).toBeVisible();
}

export const resultText = (page: Page): Locator => page.getByRole('main');
