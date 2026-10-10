import type { AccountId, AccountOutput } from '@repo/contracts';
import { hasEndedBy } from '@repo/core/accounts';

export type Branch = 'tee' | 'elbow';

type Shown = (account: AccountOutput) => boolean;

export function branchesOf(
  accounts: readonly AccountOutput[],
  shown: Shown,
): ReadonlyMap<AccountId, Branch> {
  const ids = accounts.filter(shown).map((account) => account.id);
  return new Map(
    ids.map((id, index): [AccountId, Branch] => [id, index === ids.length - 1 ? 'elbow' : 'tee']),
  );
}

export type SectionFilter = {
  readonly showEnded: boolean;
  readonly today: string | undefined;
};

const mayHaveEnded = (account: AccountOutput, today: string | undefined): boolean =>
  today === undefined ? account.activeUntil !== null : hasEndedBy(account, today);

export const shownInSection =
  ({ showEnded, today }: SectionFilter): Shown =>
  (account) =>
    showEnded || !mayHaveEnded(account, today);

export const nameContains =
  (query: string): Shown =>
  (account) =>
    account.name.toLowerCase().includes(query.trim().toLowerCase());
