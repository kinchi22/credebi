import {
  accountsIn,
  type AccountOutput,
  type OfferedTitle,
  type Side,
} from '@repo/contracts';
import { type Offered } from './lines-on-day';

export const SUGGESTED_PER_SIDE = 3;

export type Suggested = Readonly<Record<Side, readonly AccountOutput[]>>;

export const NOTHING_SUGGESTED: Suggested = { debit: [], credit: [] };

export function suggestedOn(title: OfferedTitle | undefined, offered: Offered): Suggested {
  if (title === undefined) {
    return NOTHING_SUGGESTED;
  }
  const byId = new Map(accountsIn(offered.chart).map((account) => [account.id, account]));
  const on = (side: Side): readonly AccountOutput[] =>
    title.suggested[side]
      .flatMap((id) => {
        const account = byId.get(id);
        return account === undefined ? [] : [account];
      })
      .slice(0, SUGGESTED_PER_SIDE);
  return { debit: on('debit'), credit: on('credit') };
}
