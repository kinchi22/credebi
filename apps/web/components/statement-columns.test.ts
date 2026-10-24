import { incomeStatementSchema } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { totalsUnder } from './statement-columns';

const id = (tail: number): string => `01920000-0000-7000-8000-${String(tail).padStart(12, '0')}`;

const account = (tail: number) => ({
  kind: 'account',
  account: id(tail),
  name: `Account ${String(tail)}`,
  total: 0,
});

const group = (tail: number, accounts: readonly number[]) => ({
  kind: 'group',
  group: id(tail),
  name: `Group ${String(tail)}`,
  total: 0,
  accounts: accounts.map(account),
});

const statement = (revenue: readonly object[], expense: readonly object[]) =>
  incomeStatementSchema.parse({
    revenue: { total: 0, rows: revenue },
    expense: { total: 0, rows: expense },
    netIncome: 0,
  });

describe('totalsUnder', () => {
  it('puts Totals under Expenses when Expenses has fewer Account rows', () => {
    expect(totalsUnder(statement([account(1), account(2)], [account(3)]))).toBe('expense');
  });

  it('puts Totals under Revenue when Revenue has fewer Account rows', () => {
    expect(totalsUnder(statement([account(1)], [account(2), account(3)]))).toBe('revenue');
  });

  it('puts Totals under Revenue when the two have the same number of rows', () => {
    expect(totalsUnder(statement([account(1)], [account(2)]))).toBe('revenue');
  });

  it('puts Totals under Revenue when both sections are empty', () => {
    expect(totalsUnder(statement([], []))).toBe('revenue');
  });

  it("counts an Account group's own row, so a group of one is two rows", () => {
    expect(totalsUnder(statement([group(1, [2])], [account(3)]))).toBe('expense');
    expect(totalsUnder(statement([group(1, [2])], [account(3), account(4)]))).toBe('revenue');
  });

  it("counts each of an Account group's Accounts as a row", () => {
    expect(totalsUnder(statement([group(1, [2, 3])], [account(4), account(5)]))).toBe('expense');
    expect(totalsUnder(statement([account(4), account(5), account(6)], [group(1, [2, 3])]))).toBe('revenue');
  });
});
