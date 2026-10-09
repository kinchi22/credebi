import { type DomainError, type EntryId, type Result } from '@repo/contracts';
import { readAccountNames } from '../../accounts/application/read-account-names';
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

    const names = await readAccountNames(accounts, userId.value);
    if (!names.ok) {
      return names;
    }

    const entry = makeEntry(
      draft,
      { id: newEntryId(), createdAt: now() },
      names.value,
    );
    if (!entry.ok) {
      return entry;
    }

    const saved = await entries.save(userId.value, entry.value);
    return saved.ok ? entry : saved;
  };
}
