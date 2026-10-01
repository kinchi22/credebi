import { type Side } from '@repo/contracts';
import { type AccountCode } from './entry';

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE: Readonly<Record<AccountCode, AccountType>> = {
  cash: 'asset',
  payable: 'liability',
  capital: 'equity',
  sales: 'revenue',
  expense: 'expense',
};

const NORMAL_BALANCE: Readonly<Record<AccountType, Side>> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
};

export function accountTypesInOrder(side: Side): readonly AccountType[] {
  return [
    ...ACCOUNT_TYPES.filter((type) => NORMAL_BALANCE[type] === side),
    ...ACCOUNT_TYPES.filter((type) => NORMAL_BALANCE[type] !== side),
  ];
}
