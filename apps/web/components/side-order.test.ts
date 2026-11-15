import { accountTypeSchema, sideSchema } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { SIDE_ORDER } from './side-order';

describe('SIDE_ORDER', () => {
  it('lists assets, liabilities and equity first on the debit side, then expenses and revenue', () => {
    expect(SIDE_ORDER.debit).toEqual(['asset', 'liability', 'equity', 'expense', 'revenue']);
  });

  it('lists assets, liabilities and equity first on the credit side, then revenue and expenses', () => {
    expect(SIDE_ORDER.credit).toEqual(['asset', 'liability', 'equity', 'revenue', 'expense']);
  });

  it.each(sideSchema.options)('lists every Account type exactly once on the %s side', (side) => {
    expect([...SIDE_ORDER[side]].sort()).toEqual([...accountTypeSchema.options].sort());
  });
});
