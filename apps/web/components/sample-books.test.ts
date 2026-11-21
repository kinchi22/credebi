import { accountsIn, languageSchema, type Money, type PostedEntry, type StatementRowOutput } from '@repo/contracts';
import { monthAfter } from '@repo/core/entries';
import { sumMoney } from '@repo/core/money';
import { describe, expect, it } from 'vitest';
import { CATALOGUES } from '../server/catalogues';
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
});
