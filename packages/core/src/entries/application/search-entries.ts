import { type DomainError, type Result } from '@repo/contracts';
import { readAccountNames } from '../../accounts/application/read-account-names';
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

    const names = await readAccountNames(accounts, userId.value);
    if (!names.ok) {
      return names;
    }

    const criteria = makeSearchCriteria(draft, names.value);
    if (!criteria.ok) {
      return criteria;
    }

    return entries.search(userId.value, criteria.value);
  };
}
