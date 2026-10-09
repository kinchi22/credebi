import { ok, type DomainError, type EntryId, type Result } from '@repo/contracts';
import { readAccountNames } from '../../accounts/application/read-account-names';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { changesEntry } from '../domain/correction';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { makeReversal, reversedAlready } from '../domain/reversal';
import { type EntryRepository } from '../ports/entry-repository';
import { type UnitOfWork } from '../ports/unit-of-work';

export type EditEntryDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
  readonly unitOfWork: UnitOfWork;
  readonly newEntryId: () => EntryId;
  readonly now: () => Date;
};

export type EditEntry = (
  auth: AuthContext,
  id: EntryId,
  draft: EntryDraft,
) => Promise<Result<Entry, DomainError>>;

export function createEditEntry({
  entries,
  accounts,
  unitOfWork,
  newEntryId,
  now,
}: EditEntryDependencies): EditEntry {
  return async (auth, id, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const found = await entries.find(userId.value, id);
    if (!found.ok) {
      return found;
    }
    const { entry, reversed } = found.value;
    if (reversed) {
      return reversedAlready(id);
    }
    if (!changesEntry(draft, entry)) {
      return ok(entry);
    }

    const names = await readAccountNames(accounts, userId.value);
    if (!names.ok) {
      return names;
    }

    const createdAt = now();
    const replacement = makeEntry(
      draft,
      { id: newEntryId(), createdAt },
      names.value,
    );
    if (!replacement.ok) {
      return replacement;
    }

    const reversal = makeReversal(entry, { id: newEntryId(), createdAt });
    return unitOfWork.run(async (transactional) => {
      const reversing = await transactional.saveReversal(userId.value, reversal);
      if (!reversing.ok) {
        return reversing;
      }
      const saved = await transactional.save(userId.value, replacement.value);
      return saved.ok ? replacement : saved;
    });
  };
}
