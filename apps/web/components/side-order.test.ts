import { accountTypeSchema, sideSchema } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { SIDE_ORDER } from './side-order';

describe('SIDE_ORDER', () => {
  it('lists expenses first on the debit side, then assets, liabilities, equity and revenue', () => {
    expect(SIDE_ORDER.debit).toEqual(['expense', 'asset', 'liability', 'equity', 'revenue']);
  });

  it('lists assets first on the credit side, then liabilities, revenue, equity and expenses', () => {
    expect(SIDE_ORDER.credit).toEqual(['asset', 'liability', 'revenue', 'equity', 'expense']);
  });

  it.each(sideSchema.options)('lists every Account type exactly once on the %s side', (side) => {
    expect([...SIDE_ORDER[side]].sort()).toEqual([...accountTypeSchema.options].sort());
  });
});
