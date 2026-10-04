import { domainError, err, type DomainError, type EntryId, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { makeReversal } from '../domain/reversal';
import { type EntryRepository } from '../ports/entry-repository';

export type DeleteEntryDependencies = {
  readonly entries: EntryRepository;
  readonly newEntryId: () => EntryId;
  readonly now: () => Date;
};

export type DeleteEntry = (auth: AuthContext, id: EntryId) => Promise<Result<void, DomainError>>;

export function createDeleteEntry({
  entries,
  newEntryId,
  now,
}: DeleteEntryDependencies): DeleteEntry {
  return async (auth, id) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const found = await entries.find(userId.value, id);
    if (!found.ok) {
      return found;
    }
    if (found.value.reversed) {
      return err(domainError('CONFLICT', `Entry ${id} is reversed already.`));
    }

    const reversal = makeReversal(found.value.entry, { id: newEntryId(), createdAt: now() });
    return entries.saveReversal(userId.value, reversal);
  };
}
