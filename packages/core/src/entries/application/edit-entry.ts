import { ok, type DomainError, type EntryId, type Result } from '@repo/contracts';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { changesEntry } from '../domain/correction';
import { makePostedEntry, type Entry, type EntryDraft } from '../domain/entry';
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

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const createdAt = now();
    const replacement = makePostedEntry(
      draft,
      { id: newEntryId(), createdAt },
      chart.value.accounts,
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
