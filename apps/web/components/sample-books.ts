import {
  chartSchema,
  incomeStatementSchema,
  postedEntrySchema,
  trendMonthSchema,
  type AccountType,
  type ChartOutput,
  type IncomeStatementOutput,
  type IncomeStatementQuery,
  type PostedEntry,
  type Side,
  type TrendMonthOutput,
} from '@repo/contracts';
import { calendarMonth, monthAfter } from '@repo/core/entries';

type SampleAccount =
  | 'cash'
  | 'bankDeposits'
  | 'creditCardPayable'
  | 'salary'
  | 'food'
  | 'transportation'
  | 'otherLivingExpenses';

type SampleGroup = 'cashAndDeposits' | 'livingExpenses';

type SampleTitle = 'salary' | 'groceries' | 'teamDinner' | 'subwayFare';

export type SampleCopy = {
  readonly name: (node: SampleAccount | SampleGroup) => string;
  readonly title: (title: SampleTitle) => string;
};

export type SampleBooks = {
  readonly chart: ChartOutput;
  readonly entries: readonly PostedEntry[];
  readonly statement: IncomeStatementOutput;
  readonly period: IncomeStatementQuery;
  readonly months: readonly TrendMonthOutput[];
};

type Placed = { readonly id: string; readonly accountType: AccountType };

const ACCOUNTS: Readonly<Record<SampleAccount, Placed>> = {
  cash: { id: '01900000-0000-7000-8000-000000000001', accountType: 'asset' },
  bankDeposits: { id: '01900000-0000-7000-8000-000000000002', accountType: 'asset' },
  creditCardPayable: { id: '01900000-0000-7000-8000-000000000003', accountType: 'liability' },
  salary: { id: '01900000-0000-7000-8000-000000000004', accountType: 'revenue' },
  food: { id: '01900000-0000-7000-8000-000000000005', accountType: 'expense' },
  transportation: { id: '01900000-0000-7000-8000-000000000006', accountType: 'expense' },
  otherLivingExpenses: { id: '01900000-0000-7000-8000-000000000007', accountType: 'expense' },
};

const GROUPS: Readonly<Record<SampleGroup, Placed>> = {
  cashAndDeposits: { id: '01900000-0000-7000-9000-000000000001', accountType: 'asset' },
  livingExpenses: { id: '01900000-0000-7000-9000-000000000002', accountType: 'expense' },
};

type ChartNode =
  | { readonly kind: 'account'; readonly account: SampleAccount }
  | { readonly kind: 'group'; readonly group: SampleGroup; readonly accounts: readonly SampleAccount[] };

const CHART: readonly ChartNode[] = [
  { kind: 'group', group: 'cashAndDeposits', accounts: ['cash', 'bankDeposits'] },
  { kind: 'account', account: 'creditCardPayable' },
  { kind: 'account', account: 'salary' },
  { kind: 'group', group: 'livingExpenses', accounts: ['food', 'transportation', 'otherLivingExpenses'] },
];

const ACTIVE_FROM = '2025-01-01';

type SampleLine = readonly [SampleAccount, Side, number];

type SampleEntry = {
  readonly id: string;
  readonly entryDate: string;
  readonly title: SampleTitle;
  readonly lines: readonly SampleLine[];
  readonly total: number;
};

const ENTRIES: readonly SampleEntry[] = [
  {
    id: '01900000-0000-7000-a000-000000000001',
    entryDate: '2026-10-25',
    title: 'salary',
    lines: [
      ['bankDeposits', 'debit', 3_200_000],
      ['salary', 'credit', 3_200_000],
    ],
    total: 3_200_000,
  },
  {
    id: '01900000-0000-7000-a000-000000000002',
    entryDate: '2026-10-21',
    title: 'groceries',
    lines: [
      ['food', 'debit', 48_000],
      ['otherLivingExpenses', 'debit', 12_000],
      ['creditCardPayable', 'credit', 60_000],
    ],
    total: 60_000,
  },
  {
    id: '01900000-0000-7000-a000-000000000003',
    entryDate: '2026-10-19',
    title: 'teamDinner',
    lines: [
      ['food', 'debit', 64_000],
      ['creditCardPayable', 'credit', 44_000],
      ['cash', 'credit', 20_000],
    ],
    total: 64_000,
  },
  {
    id: '01900000-0000-7000-a000-000000000004',
    entryDate: '2026-10-18',
    title: 'subwayFare',
    lines: [
      ['transportation', 'debit', 1_550],
      ['cash', 'credit', 1_550],
    ],
    total: 1_550,
  },
];

const PERIOD_TOTALS: Readonly<Partial<Record<SampleAccount, number>>> = {
  salary: 3_200_000,
  food: 412_300,
  transportation: 68_500,
  otherLivingExpenses: 523_000,
};

const STATEMENT_DAY = '2026-10-01';

const FIRST_MONTH = '2025-11';

const TREND: readonly (readonly [number, number, number])[] = [
  [18_200_000, 1_400_000, 16_800_000],
  [18_900_000, 1_100_000, 17_800_000],
  [19_400_000, 1_600_000, 17_800_000],
  [20_600_000, 1_200_000, 19_400_000],
  [21_100_000, 900_000, 20_200_000],
  [22_400_000, 1_300_000, 21_100_000],
  [23_000_000, 1_500_000, 21_500_000],
  [24_300_000, 1_000_000, 23_300_000],
  [25_800_000, 1_200_000, 24_600_000],
  [26_400_000, 800_000, 25_600_000],
  [28_100_000, 1_100_000, 27_000_000],
  [29_996_200, 800_000, 29_196_200],
];

function chartOf(copy: SampleCopy): ChartOutput {
  const account = (key: SampleAccount, group: SampleGroup | null): object => ({
    id: ACCOUNTS[key].id,
    accountType: ACCOUNTS[key].accountType,
    groupId: group === null ? null : GROUPS[group].id,
    name: copy.name(key),
    description: null,
    activeFrom: ACTIVE_FROM,
    activeUntil: null,
  });
  return chartSchema.parse(
    CHART.map((node) =>
      node.kind === 'account'
        ? { kind: 'account', account: account(node.account, null) }
        : {
            kind: 'group',
            group: { ...GROUPS[node.group], name: copy.name(node.group), description: null },
            accounts: node.accounts.map((key) => account(key, node.group)),
          },
    ),
  );
}

const entriesOf = (copy: SampleCopy): readonly PostedEntry[] =>
  ENTRIES.map((entry) =>
    postedEntrySchema.parse({
      id: entry.id,
      entryDate: entry.entryDate,
      title: copy.title(entry.title),
      memo: '',
      lines: entry.lines.map(([account, side, amount]) => ({
        account: ACCOUNTS[account].id,
        accountName: copy.name(account),
        side,
        amount,
      })),
      total: entry.total,
      createdAt: `${entry.entryDate}T09:00:00.000Z`,
    }),
  );

type SampleRow = Readonly<Record<string, unknown>> & { readonly total: number };

const totalOf = (key: SampleAccount): number => PERIOD_TOTALS[key] ?? 0;

const sum = (totals: readonly number[]): number => totals.reduce((total, amount) => total + amount, 0);

const statementOf = (copy: SampleCopy): IncomeStatementOutput => {
  const row = (key: SampleAccount) => ({
    kind: 'account' as const,
    account: ACCOUNTS[key].id,
    name: copy.name(key),
    total: totalOf(key),
  });
  const rowsOf = (accountType: 'revenue' | 'expense'): SampleRow[] =>
    CHART.flatMap((node): SampleRow[] => {
      if (node.kind === 'account') return ACCOUNTS[node.account].accountType === accountType ? [row(node.account)] : [];
      if (GROUPS[node.group].accountType !== accountType) return [];
      return [
        {
          kind: 'group' as const,
          group: GROUPS[node.group].id,
          name: copy.name(node.group),
          total: sum(node.accounts.map(totalOf)),
          collapsed: false,
          accounts: node.accounts.map(row),
        },
      ];
    });
  const revenue = rowsOf('revenue');
  const expense = rowsOf('expense');
  const revenueTotal = sum(revenue.map(({ total }) => total));
  const expenseTotal = sum(expense.map(({ total }) => total));
  return incomeStatementSchema.parse({
    revenue: { total: revenueTotal, rows: revenue },
    expense: { total: expenseTotal, rows: expense },
    netIncome: revenueTotal - expenseTotal,
  });
};

const monthsOf = (): readonly TrendMonthOutput[] =>
  TREND.map(([totalAssets, totalLiabilities, netWorth], index) =>
    trendMonthSchema.parse({ month: monthAfter(FIRST_MONTH, index), totalAssets, totalLiabilities, netWorth }),
  );

export const sampleBooks = (copy: SampleCopy): SampleBooks => ({
  chart: chartOf(copy),
  entries: entriesOf(copy),
  statement: statementOf(copy),
  period: calendarMonth(STATEMENT_DAY),
  months: monthsOf(),
});
