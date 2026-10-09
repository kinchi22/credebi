import { type DomainError, type EntryId, type Result } from '@repo/contracts';
import { accountNames } from '../../accounts/domain/account';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';

export type PostEntryDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
  readonly newEntryId: () => EntryId;
  readonly now: () => Date;
};

export type PostEntry = (
  auth: AuthContext,
  draft: EntryDraft,
) => Promise<Result<Entry, DomainError>>;

export function createPostEntry({
  entries,
  accounts,
  newEntryId,
  now,
}: PostEntryDependencies): PostEntry {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const entry = makeEntry(
      draft,
      { id: newEntryId(), createdAt: now() },
      accountNames(chart.value),
    );
    if (!entry.ok) {
      return entry;
    }

    const saved = await entries.save(userId.value, entry.value);
    return saved.ok ? entry : saved;
  };
}
