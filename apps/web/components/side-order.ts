import { type AccountType, type Side } from '@repo/contracts';

export const SIDE_ORDER: Readonly<Record<Side, readonly AccountType[]>> = {
  debit: ['asset', 'liability', 'equity', 'expense', 'revenue'],
  credit: ['asset', 'liability', 'equity', 'revenue', 'expense'],
};
