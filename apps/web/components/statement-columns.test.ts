import { statementSectionSchema } from '@repo/contracts';
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

const section = (...rows: readonly object[]) => statementSectionSchema.parse({ total: 0, rows });

describe('totalsUnder', () => {
  it('puts Totals under the left section when it has fewer Account rows', () => {
    expect(totalsUnder(section(account(3)), section(account(1), account(2)))).toBe('left');
  });

  it('puts Totals under the right section when it has fewer Account rows', () => {
    expect(totalsUnder(section(account(2), account(3)), section(account(1)))).toBe('right');
  });

  it('puts Totals under the right section when the two have the same number of rows', () => {
    expect(totalsUnder(section(account(2)), section(account(1)))).toBe('right');
  });

  it('puts Totals under the right section when both sections are empty', () => {
    expect(totalsUnder(section(), section())).toBe('right');
  });

  it("counts an Account group's own row, so a group of one is two rows", () => {
    expect(totalsUnder(section(account(3)), section(group(1, [2])))).toBe('left');
    expect(totalsUnder(section(account(3), account(4)), section(group(1, [2])))).toBe('right');
  });

  it("counts each of an Account group's Accounts as a row", () => {
    expect(totalsUnder(section(account(4), account(5)), section(group(1, [2, 3])))).toBe('left');
    expect(totalsUnder(section(group(1, [2, 3])), section(account(4), account(5), account(6)))).toBe('right');
  });
});
