import { type AccountType, type Side } from '@repo/contracts';

export type BalanceDirection = 'increase' | 'decrease';

const NORMAL_SIDE: Readonly<Record<AccountType, Side>> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
};

export function balanceDirection(accountType: AccountType, side: Side): BalanceDirection {
  return NORMAL_SIDE[accountType] === side ? 'increase' : 'decrease';
}
