import { describe, expect, it } from 'vitest';
import { balanceDirection } from './balance-direction';

describe('balanceDirection', () => {
  it.each([
    ['asset', 'debit', 'increase'],
    ['asset', 'credit', 'decrease'],
    ['liability', 'debit', 'decrease'],
    ['liability', 'credit', 'increase'],
    ['equity', 'debit', 'decrease'],
    ['equity', 'credit', 'increase'],
    ['revenue', 'debit', 'decrease'],
    ['revenue', 'credit', 'increase'],
    ['expense', 'debit', 'increase'],
    ['expense', 'credit', 'decrease'],
  ] as const)('says a %s account on the %s side will %s', (accountType, side, direction) => {
    expect(balanceDirection(accountType, side)).toBe(direction);
  });
});
