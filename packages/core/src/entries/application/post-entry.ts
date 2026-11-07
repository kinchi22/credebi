import {
  type ConnectionId,
  type DomainError,
  type EntryId,
  type Result,
  type UserId,
} from '@repo/contracts';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { makePostedEntry, type Entry, type EntryDraft } from '../domain/entry';
import { retriedEntry } from '../domain/request-key';
import { type EntryRepository } from '../ports/entry-repository';
import { type UnitOfWork } from '../ports/unit-of-work';

export type PostEntryDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
  readonly unitOfWork: UnitOfWork;
  readonly newEntryId: () => EntryId;
  readonly now: () => Date;
};

export type PostEntry = (
  auth: AuthContext,
  draft: EntryDraft,
  requestKey?: string,
) => Promise<Result<Entry, DomainError>>;

export function createPostEntry({
  entries,
  accounts,
  unitOfWork,
  newEntryId,
  now,
}: PostEntryDependencies): PostEntry {
  const madeEntry = async (userId: UserId, draft: EntryDraft): Promise<Result<Entry, DomainError>> => {
    const chart = await accounts.readChart(userId);
    if (!chart.ok) {
      return chart;
    }
    return makePostedEntry(draft, { id: newEntryId(), createdAt: now() }, chart.value.accounts);
  };

  const postedOnce = (
    connectionId: ConnectionId | undefined,
    userId: UserId,
    draft: EntryDraft,
    requestKey: string,
  ): Promise<Result<Entry, DomainError>> =>
    unitOfWork.run(async (transactional, requestKeys) => {
      const recorded = await requestKeys.find(userId, requestKey);
      if (!recorded.ok) {
        return recorded;
      }
      if (recorded.value !== undefined) {
        const found = await transactional.find(userId, recorded.value);
        return found.ok ? retriedEntry(requestKey, draft, found.value) : found;
      }

      const entry = await madeEntry(userId, draft);
      if (!entry.ok) {
        return entry;
      }
      const saved = await transactional.save(userId, entry.value);
      if (!saved.ok) {
        return saved;
      }
      const recording = await requestKeys.record(userId, {
        requestKey,
        entryId: entry.value.id,
        connectionId,
      });
      return recording.ok ? entry : recording;
    });

  return async (auth, draft, requestKey) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    if (requestKey !== undefined) {
      const posting = await postedOnce(auth.connectionId, userId.value, draft, requestKey);
      return posting.ok || posting.error.code !== 'CONFLICT'
        ? posting
        : postedOnce(auth.connectionId, userId.value, draft, requestKey);
    }

    const entry = await madeEntry(userId.value, draft);
    if (!entry.ok) {
      return entry;
    }
    const saved = await entries.save(userId.value, entry.value);
    return saved.ok ? entry : saved;
  };
}
