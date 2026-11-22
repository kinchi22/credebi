import {
  accountGroupIdSchema,
  accountIdSchema,
  accountsIn,
  accountTypeSchema,
  domainError,
  err,
  languageSchema,
  ok,
  userIdSchema,
  type AccountType,
  type ChartOutput,
  type Money,
  type PostedEntry,
  type StatementRowOutput,
} from '@repo/contracts';
import { createTestSignIn, type SessionToken, type SessionTokenHash, type UserRepository } from '@repo/core/auth';
import { monthAfter } from '@repo/core/entries';
import { sumMoney } from '@repo/core/money';
import { describe, expect, it } from 'vitest';
import { CATALOGUES, startingChartCopy } from '../server/catalogues';
import { fittedTicks } from './chart-axis';
import { linesOn } from './entry-lines';
import { sampleBooks, type SampleBooks } from './sample-books';

const byPath = (): SampleBooks =>
  sampleBooks({
    name: (node) => `startingChart.${node}.name`,
    title: (title) => `landingPage.sampleTitles.${title}`,
  });

const sum = (amounts: readonly Money[]): number => {
  const total = sumMoney(amounts);
  if (!total.ok) throw new Error('the sample amounts add up');
  return total.value;
};

const sideTotal = (entry: PostedEntry, side: 'debit' | 'credit'): number =>
  sum(linesOn(entry, side).map((line) => line.amount));

const rowTotals = (rows: readonly StatementRowOutput[]): number => sum(rows.map((row) => row.total));

function copyAt(catalogue: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined),
    catalogue,
  );
}

const statementNames = (rows: readonly StatementRowOutput[]): readonly string[] =>
  rows.flatMap((row) => (row.kind === 'account' ? [row.name] : [row.name, ...row.accounts.map(({ name }) => name)]));

const namesIn = (books: SampleBooks): readonly string[] => [
  ...books.chart.flatMap((node) => (node.kind === 'group' ? [node.group.name] : [])),
  ...accountsIn(books.chart).map(({ name }) => name),
  ...books.entries.flatMap((entry) => [entry.title, ...entry.lines.map(({ accountName }) => accountName)]),
  ...statementNames(books.statement.revenue.rows),
  ...statementNames(books.statement.expense.rows),
];

type StartingChart = Parameters<UserRepository['add']>[2];

type OutlineAccount = { readonly accountType: AccountType; readonly name: string };

type OutlineNode =
  | ({ readonly kind: 'account' } & OutlineAccount)
  | ({ readonly kind: 'group'; readonly accounts: readonly OutlineAccount[] } & OutlineAccount);

const uuid = (variant: string, serial: number): string =>
  `01900000-0000-7000-${variant}-${String(serial).padStart(12, '0')}`;

const serials = (): (() => number) => {
  let last = 0;
  return () => (last += 1);
};

async function newUsersChart(): Promise<StartingChart> {
  const added: StartingChart[] = [];
  const unavailable = domainError('DEPENDENCY_UNAVAILABLE', 'No stored User is read here.');
  const nextAccount = serials();
  const nextGroup = serials();
  const signIn = createTestSignIn({
    users: {
      findByIdentity: () => Promise.resolve(ok(undefined)),
      add: (_user, _identity, chart) => {
        added.push(chart);
        return Promise.resolve(ok(undefined));
      },
      updateProfile: () => Promise.resolve(err(unavailable)),
    },
    sessions: {
      add: () => Promise.resolve(ok(undefined)),
      find: () => Promise.resolve(err(unavailable)),
      renew: () => Promise.resolve(err(unavailable)),
      remove: () => Promise.resolve(err(unavailable)),
    },
    settings: { read: () => Promise.resolve(err(unavailable)) },
    startingChartCopy,
    newUserId: () => userIdSchema.parse(uuid('b000', 1)),
    newAccountId: () => accountIdSchema.parse(uuid('8000', nextAccount())),
    newAccountGroupId: () => accountGroupIdSchema.parse(uuid('9000', nextGroup())),
    newSessionToken: () => 'session' as SessionToken,
    hashSessionToken: (token) => `hash of ${token}` as SessionTokenHash,
    now: () => new Date('2026-10-01T09:00:00.000Z'),
  });
  const signedIn = await signIn('new-user', 'en');
  const [chart] = added;
  if (!signedIn.ok || chart === undefined) throw new Error('a new User is given the starting Chart of accounts');
  return chart;
}

const byPosition = <Placed extends { readonly position: number }>(placed: readonly Placed[]): Placed[] =>
  [...placed].sort((first, second) => first.position - second.position);

function startingOutline({ accounts, groups }: StartingChart): readonly OutlineNode[] {
  const outlined = ({ accountType, name }: OutlineAccount): OutlineAccount => ({ accountType, name });
  return accountTypeSchema.options.flatMap((accountType) =>
    byPosition([
      ...groups
        .filter((group) => group.accountType === accountType)
        .map((group) => ({
          position: group.position,
          node: {
            kind: 'group' as const,
            ...outlined(group),
            accounts: byPosition(accounts.filter(({ groupId }) => groupId === group.id)).map(outlined),
          },
        })),
      ...accounts
        .filter((account) => account.accountType === accountType && account.groupId === null)
        .map((account) => ({ position: account.position, node: { kind: 'account' as const, ...outlined(account) } })),
    ]).map(({ node }) => node),
  );
}

const sampleOutline = (chart: ChartOutput): readonly OutlineNode[] =>
  chart.map((node) =>
    node.kind === 'account'
      ? { kind: 'account', accountType: node.account.accountType, name: node.account.name }
      : {
          kind: 'group',
          accountType: node.group.accountType,
          name: node.group.name,
          accounts: node.accounts.map(({ accountType, name }) => ({ accountType, name })),
        },
  );

describe('sampleBooks', () => {
  it('holds four Entries, two of them with more than one line on a side', () => {
    const books = byPath();
    expect(books.entries).toHaveLength(4);
    expect(books.entries.filter((entry) => entry.lines.length > 2)).toHaveLength(2);
  });

  it('balances every Entry, its total the sum of its debits and of its credits', () => {
    for (const entry of byPath().entries) {
      expect(sideTotal(entry, 'debit'), entry.title).toBeGreaterThan(0);
      expect(sideTotal(entry, 'credit'), entry.title).toBe(sideTotal(entry, 'debit'));
      expect(entry.total, entry.title).toBe(sideTotal(entry, 'debit'));
    }
  });

  it.each(languageSchema.options)('names every Account, Account group and Title with existing copy in %s', (language) => {
    const names = namesIn(byPath());
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(copyAt(CATALOGUES[language], name), name).toEqual(expect.stringMatching(/\S/u));
    }
  });

  it('names each Entry line after the Account in the Chart of accounts it refers to', () => {
    const books = byPath();
    const chartNames = new Map(accountsIn(books.chart).map((account) => [account.id, account.name]));
    for (const line of books.entries.flatMap((entry) => entry.lines)) {
      expect(line.accountName).toBe(chartNames.get(line.account));
    }
  });

  it('lays out the starting Chart of accounts a new User is given, all but Opening balance equity', async () => {
    const starting = startingOutline(await newUsersChart());
    const openingBalanceEquity = CATALOGUES.en.startingChart.openingBalanceEquity.name;
    const sample = sampleBooks({
      name: (node) => CATALOGUES.en.startingChart[node].name,
      title: (title) => CATALOGUES.en.landingPage.sampleTitles[title],
    });
    expect(starting.map(({ name }) => name)).toContain(openingBalanceEquity);
    expect(sampleOutline(sample.chart)).toEqual(starting.filter(({ name }) => name !== openingBalanceEquity));
  });

  it('places each Account in a group under that group and every other Account under none, with no memo on any Entry', () => {
    const books = byPath();
    for (const node of books.chart) {
      const placed = node.kind === 'group' ? node.accounts.map(({ groupId }) => groupId) : [node.account.groupId];
      expect(placed).toEqual(placed.map(() => (node.kind === 'group' ? node.group.id : null)));
    }
    expect(books.entries.map(({ memo }) => memo)).toEqual(books.entries.map(() => ''));
  });

  it('reads names from the copy it is given', () => {
    const given = sampleBooks({ name: (node) => `name of ${node}`, title: (title) => `title of ${title}` });
    expect(namesIn(given).every((name) => name.startsWith('name of ') || name.startsWith('title of '))).toBe(true);
    expect(given.entries.every((entry) => entry.title.startsWith('title of '))).toBe(true);
  });

  it('totals the Income statement from its rows, with Living expenses as an open group', () => {
    const books = byPath();
    const { revenue, expense, netIncome } = books.statement;
    const groups = expense.rows.filter((row) => row.kind === 'group');
    expect(groups.map(({ name }) => name)).toEqual(['startingChart.livingExpenses.name']);
    for (const group of groups) {
      expect(group.collapsed).toBe(false);
      expect(group.total).toBe(sum(group.accounts.map(({ total }) => total)));
    }
    expect(revenue.total).toBe(rowTotals(revenue.rows));
    expect(expense.total).toBe(rowTotals(expense.rows));
    expect(netIncome).toBe(revenue.total - expense.total);
  });

  it('lists in the Income statement every revenue and expense Account and group of the Chart of accounts, in its order', () => {
    const books = byPath();
    type Placed = { readonly id: string; readonly children: string[] };
    const inChart = (...types: AccountType[]): Placed[] =>
      books.chart.flatMap((node): Placed[] => {
        if (node.kind === 'account')
          return types.includes(node.account.accountType) ? [{ id: node.account.id, children: [] as string[] }] : [];
        return types.includes(node.group.accountType)
          ? [{ id: node.group.id, children: node.accounts.map(({ id }) => id) }]
          : [];
      });
    const inStatement = (rows: readonly StatementRowOutput[]) =>
      rows.map((row) =>
        row.kind === 'account'
          ? { id: row.account, children: [] as string[] }
          : { id: row.group, children: row.accounts.map(({ account }) => account) },
      );
    expect(inStatement(books.statement.revenue.rows)).toEqual(inChart('revenue'));
    expect(inStatement(books.statement.expense.rows)).toEqual(inChart('expense'));
  });

  it('dates every Entry within the month the Income statement covers, the last month of the trend', () => {
    const books = byPath();
    const { from, to } = books.period;
    for (const { entryDate } of books.entries) {
      expect(entryDate >= from && entryDate <= to, entryDate).toBe(true);
    }
    expect(books.months.at(-1)?.month).toBe(from.slice(0, 7));
    expect(to.slice(0, 7)).toBe(from.slice(0, 7));
  });

  it('holds twelve consecutive months of the trend, each Net worth its assets less its liabilities', () => {
    const books = byPath();
    expect(books.months).toHaveLength(12);
    const [first] = books.months;
    expect(books.months.map(({ month }) => month)).toEqual(
      books.months.map((_, index) => monthAfter(first?.month ?? '', index)),
    );
    for (const month of books.months) {
      expect(month.netWorth).toBe(month.totalAssets - month.totalLiabilities);
    }
  });

  it('raises Net worth over the statement month by exactly the Net income of that month', () => {
    const books = byPath();
    const [before, during] = books.months.slice(-2);
    expect(during?.month).toBe(books.period.from.slice(0, 7));
    expect((during?.netWorth ?? 0) - (before?.netWorth ?? 0)).toBe(books.statement.netIncome);
  });

  it('reaches within half a step of the top tick of the trend axis', () => {
    const values = byPath().months.flatMap(({ totalAssets, totalLiabilities, netWorth }) => [
      totalAssets,
      totalLiabilities,
      netWorth,
    ]);
    const ticks = fittedTicks(values);
    const [below, top] = ticks.slice(-2);
    expect(Math.max(...values)).toBeGreaterThan((top ?? 0) - ((top ?? 0) - (below ?? 0)) / 2);
  });
});
