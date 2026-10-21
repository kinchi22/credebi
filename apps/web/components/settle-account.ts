import { type AccountOutput } from '@repo/contracts';
import { nameContains } from './chart-tree';

export type SettledAccount =
  | { readonly outcome: 'any' }
  | { readonly outcome: 'account'; readonly account: AccountOutput }
  | { readonly outcome: 'refused' };

export function settleAccount(text: string, accounts: readonly AccountOutput[]): SettledAccount {
  const typed = text.trim();
  if (typed === '') {
    return { outcome: 'any' };
  }
  const wanted = typed.toLowerCase();
  const exact = accounts.find((account) => account.name.toLowerCase() === wanted);
  if (exact !== undefined) {
    return { outcome: 'account', account: exact };
  }
  const [only, ...others] = accounts.filter(nameContains(typed));
  return only !== undefined && others.length === 0 ? { outcome: 'account', account: only } : { outcome: 'refused' };
}
