import type { AccountGroupId, AccountId, AccountOutput, Side } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { accountTypesIn, hasOneLinePerSide, linesOn } from './entry-lines';

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

const account = (id: string, accountType: AccountOutput['accountType']): AccountOutput => ({
  id: id as AccountId,
  accountType,
  groupId: null,
  name: id,
  description: null,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

describe('accountTypesIn', () => {
  it("maps each Account in the chart, in an Account group or not, to its Account type", () => {
    const cash = account('01920000-0000-7000-8000-00000000c001', 'asset');
    const card = account('01920000-0000-7000-8000-00000000c002', 'liability');
    const salary = account('01920000-0000-7000-8000-00000000c003', 'revenue');
    const types = accountTypesIn([
      { kind: 'account', account: cash },
      {
        kind: 'group',
        group: {
          id: '01920000-0000-7000-8000-00000000b001' as AccountGroupId,
          accountType: 'liability',
          name: 'Cards',
          description: '',
        },
        accounts: [card],
      },
      { kind: 'account', account: salary },
    ]);
    expect([...types]).toEqual([
      [cash.id, 'asset'],
      [card.id, 'liability'],
      [salary.id, 'revenue'],
    ]);
  });
});
