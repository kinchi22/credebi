import { type AccountCode } from './entry';

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_OF: Readonly<Record<AccountCode, AccountType>> = {
  cash: 'asset',
  payable: 'liability',
  capital: 'equity',
  sales: 'revenue',
  expense: 'expense',
};
