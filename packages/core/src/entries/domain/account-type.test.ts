import { describe, expect, it } from 'vitest';
import { CHART_OF_ACCOUNTS } from './entry';
import { ACCOUNT_TYPE_OF } from './account-type';

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
