import type { Side } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { hasOneLinePerSide, linesOn } from './entry-lines';

const line = (side: Side, account: string) => ({ side, account });

const CASH_DEBIT = line('debit', 'Cash');
const EXPENSES_DEBIT = line('debit', 'Expenses');
const SALES_CREDIT = line('credit', 'Sales');

describe('linesOn', () => {
  it('keeps only the lines on the given Side, in their order', () => {
    const entry = { lines: [CASH_DEBIT, SALES_CREDIT, EXPENSES_DEBIT] };
    expect(linesOn(entry, 'debit')).toEqual([CASH_DEBIT, EXPENSES_DEBIT]);
    expect(linesOn(entry, 'credit')).toEqual([SALES_CREDIT]);
  });

  it('finds no line on a Side the entry has none on', () => {
    expect(linesOn({ lines: [CASH_DEBIT] }, 'credit')).toEqual([]);
  });
});

describe('hasOneLinePerSide', () => {
  it('holds for an entry with one debit and one credit line', () => {
    expect(hasOneLinePerSide({ lines: [SALES_CREDIT, CASH_DEBIT] })).toBe(true);
  });

  it('does not hold for an entry with two lines on a Side', () => {
    expect(hasOneLinePerSide({ lines: [SALES_CREDIT, CASH_DEBIT, EXPENSES_DEBIT] })).toBe(false);
  });

  it('does not hold for an entry with no line on a Side', () => {
    expect(hasOneLinePerSide({ lines: [CASH_DEBIT, EXPENSES_DEBIT] })).toBe(false);
  });

  it('does not hold for an entry with no lines', () => {
    expect(hasOneLinePerSide({ lines: [] })).toBe(false);
  });
});
