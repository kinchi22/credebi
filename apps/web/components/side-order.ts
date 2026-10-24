import { type AccountType, type Side } from '@repo/contracts';

export const SIDE_ORDER: Readonly<Record<Side, readonly AccountType[]>> = {
  debit: ['expense', 'asset', 'liability', 'equity', 'revenue'],
  credit: ['asset', 'liability', 'revenue', 'equity', 'expense'],
};
