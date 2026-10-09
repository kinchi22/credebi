import { type DomainError, type Result } from '@repo/contracts';
import { accountNames } from '../../accounts/domain/account';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry } from '../domain/entry';
import { makeSearchCriteria, type SearchCriteriaDraft } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';

export type SearchEntriesDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
};

export type SearchEntries = (
  auth: AuthContext,
  criteria: SearchCriteriaDraft,
) => Promise<Result<readonly Entry[], DomainError>>;

export function createSearchEntries({
  entries,
  accounts,
}: SearchEntriesDependencies): SearchEntries {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const criteria = makeSearchCriteria(draft, accountNames(chart.value));
    if (!criteria.ok) {
      return criteria;
    }

    return entries.search(userId.value, criteria.value);
  };
}
