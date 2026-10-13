import type { AccountId, ChartOutput, Money, Side, TitleLine } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { prefillFrom, type FormLines } from './title-prefill';

const id = (tail: string): AccountId => `01920000-0000-7000-8000-${tail.padStart(12, '0')}` as AccountId;

const account = (tail: string, name: string) => ({
  id: id(tail),
  accountType: 'asset' as const,
  groupId: null,
  name,
  description: null,
  activeFrom: '2026-01-01',
  activeUntil: null,
});

const CASH = account('c001', 'Cash');
const EXPENSES = account('c002', 'Expenses');
const SALES = account('c003', 'Sales');
const OLD_WALLET = account('c004', 'Old wallet');

const CHART: ChartOutput = [
  { kind: 'account', account: CASH },
  { kind: 'account', account: EXPENSES },
  { kind: 'account', account: SALES },
  { kind: 'account', account: { ...OLD_WALLET, activeUntil: '2026-01-31' } },
];

const source = (side: Side, tail: string, amount: number): TitleLine => ({
  side,
  account: id(tail),
  amount: amount as Money,
});

const COFFEE: readonly TitleLine[] = [source('credit', 'c001', 4500), source('debit', 'c002', 4500)];

const SALARY: readonly TitleLine[] = [
  source('credit', 'c003', 12500),
  source('debit', 'c001', 9000),
  source('debit', 'c002', 3500),
];

const EMPTY_TWO_LINE: FormLines = {
  mode: 'two-line',
  debit: undefined,
  credit: undefined,
  amount: '',
};

const EMPTY_MULTI_LINE: FormLines = { mode: 'multi-line', lines: [] };

describe('prefillFrom', () => {
  it('fills empty Two-line mode lines with the debit and the credit line of a source with one line per Side, debit first', () => {
    expect(prefillFrom(EMPTY_TWO_LINE, COFFEE, CHART)).toEqual({
      outcome: 'filled',
      lines: [
        { side: 'debit', account: EXPENSES.id, accountName: 'Expenses', amount: '4500' },
        { side: 'credit', account: CASH.id, accountName: 'Cash', amount: '4500' },
      ],
    });
  });

  it('counts a blank amount as empty in Two-line mode', () => {
    expect(prefillFrom({ ...EMPTY_TWO_LINE, amount: '  ' }, COFFEE, CHART).outcome).toBe('filled');
  });

  it('keeps Two-line mode lines once either Account is chosen or an amount is typed', () => {
    expect(prefillFrom({ ...EMPTY_TWO_LINE, debit: SALES.id }, COFFEE, CHART)).toEqual({
      outcome: 'kept',
    });
    expect(prefillFrom({ ...EMPTY_TWO_LINE, credit: SALES.id }, COFFEE, CHART)).toEqual({
      outcome: 'kept',
    });
    expect(prefillFrom({ ...EMPTY_TWO_LINE, amount: '500' }, COFFEE, CHART)).toEqual({
      outcome: 'kept',
    });
  });

  it('refuses in Two-line mode a source with more than one line on a Side', () => {
    expect(prefillFrom(EMPTY_TWO_LINE, SALARY, CHART)).toEqual({ outcome: 'needs-multi-line' });
    expect(
      prefillFrom(
        EMPTY_TWO_LINE,
        [source('debit', 'c002', 100), source('credit', 'c001', 50), source('credit', 'c003', 50)],
        CHART,
      ),
    ).toEqual({ outcome: 'needs-multi-line' });
  });

  it('keeps Two-line mode lines that are not empty without refusing a source with more than one line on a Side', () => {
    expect(prefillFrom({ ...EMPTY_TWO_LINE, amount: '1' }, SALARY, CHART)).toEqual({
      outcome: 'kept',
    });
  });

  it('fills an empty Multi-line mode form with every line of the source, debits first, each in its stored order', () => {
    expect(prefillFrom(EMPTY_MULTI_LINE, SALARY, CHART)).toEqual({
      outcome: 'filled',
      lines: [
        { side: 'debit', account: CASH.id, accountName: 'Cash', amount: '9000' },
        { side: 'debit', account: EXPENSES.id, accountName: 'Expenses', amount: '3500' },
        { side: 'credit', account: SALES.id, accountName: 'Sales', amount: '12500' },
      ],
    });
  });

  it('keeps Multi-line mode lines once the form has a line, even one with no amount', () => {
    expect(prefillFrom({ mode: 'multi-line', lines: [{}] }, SALARY, CHART)).toEqual({
      outcome: 'kept',
    });
  });

  it('fills a line whose Account is not active, leaving the day to judge it', () => {
    expect(
      prefillFrom(EMPTY_MULTI_LINE, [source('debit', 'c004', 500), source('credit', 'c001', 500)], CHART),
    ).toEqual({
      outcome: 'filled',
      lines: [
        { side: 'debit', account: OLD_WALLET.id, accountName: 'Old wallet', amount: '500' },
        { side: 'credit', account: CASH.id, accountName: 'Cash', amount: '500' },
      ],
    });
  });
});
