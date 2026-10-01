import { describe, expect, it } from 'vitest';
import { CHART_OF_ACCOUNTS } from './entry';
import { ACCOUNT_TYPE_OF, ACCOUNT_TYPES, accountTypesInOrder } from './normal-balance';

describe('accountTypesInOrder', () => {
  it('lists asset and expense first on the debit Side, the rest after in their usual order', () => {
    expect(accountTypesInOrder('debit')).toEqual([
      'asset',
      'expense',
      'liability',
      'equity',
      'revenue',
    ]);
  });

  it('lists liability, equity and revenue first on the credit Side, the rest after in their usual order', () => {
    expect(accountTypesInOrder('credit')).toEqual([
      'liability',
      'equity',
      'revenue',
      'asset',
      'expense',
    ]);
  });

  it.each(['debit', 'credit'] as const)(
    'orders every Account type on the %s Side and leaves none out',
    (side) => {
      expect([...accountTypesInOrder(side)].sort()).toEqual([...ACCOUNT_TYPES].sort());
    },
  );
});

describe('ACCOUNT_TYPE_OF', () => {
  it('gives each Account in the Chart of accounts its Account type', () => {
    expect(CHART_OF_ACCOUNTS.map((code) => ACCOUNT_TYPE_OF[code])).toEqual([
      'asset',
      'liability',
      'equity',
      'revenue',
      'expense',
    ]);
  });
});
