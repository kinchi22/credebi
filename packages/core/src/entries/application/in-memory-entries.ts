import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type EntryId,
  type Result,
  type UserId,
} from '@repo/contracts';
import { addMoney, MONEY_ZERO } from '../../money/domain/money';
import { type Entry } from '../domain/entry';
import { type AccountSums } from '../domain/statement';
import { type EntryRepository, type FoundEntry } from '../ports/entry-repository';
import { type UnitOfWork } from '../ports/unit-of-work';

export type StoredEntry = {
  readonly userId: UserId;
  readonly entry: Entry;
  readonly reverses?: EntryId;
};

export type InMemoryEntries = {
  readonly rows: readonly StoredEntry[];
  readonly entries: EntryRepository;
  readonly unitOfWork: UnitOfWork;
};

function repositoryOver(rows: StoredEntry[]): EntryRepository {
  const reversed = (id: EntryId): boolean => rows.some((row) => row.reverses === id);
  const shownOf = (userId: UserId): readonly Entry[] =>
    rows
      .filter(
        (row) => row.userId === userId && row.reverses === undefined && !reversed(row.entry.id),
      )
      .map((row) => row.entry);
  return {
    save: (userId, entry) => {
      rows.push({ userId, entry });
      return Promise.resolve(ok(undefined));
    },
    saveReversal: (userId, reversal) => {
      if (reversed(reversal.reverses)) {
        return Promise.resolve(err(domainError('CONFLICT', 'Reversed already.')));
      }
      rows.push({ userId, entry: reversal, reverses: reversal.reverses });
      return Promise.resolve(ok(undefined));
    },
    find: (userId, id): Promise<Result<FoundEntry, DomainError>> => {
      const row = rows.find(
        (candidate) =>
          candidate.entry.id === id &&
          candidate.userId === userId &&
          candidate.reverses === undefined,
      );
      return Promise.resolve(
        row === undefined
          ? err(domainError('NOT_FOUND', 'No such entry.'))
          : ok({ entry: row.entry, reversed: reversed(id) }),
      );
    },
    search: (userId) => Promise.resolve(ok(shownOf(userId))),
    accountTotals: (userId, range): Promise<Result<readonly AccountSums[], DomainError>> => {
      const totals = new Map<AccountId, AccountSums>();
      for (const entry of shownOf(userId)) {
        const started = range.from === undefined || range.from <= entry.entryDate;
        if (started && entry.entryDate <= range.to) {
          for (const line of entry.lines) {
            const held = totals.get(line.account) ?? {
              account: line.account,
              debit: MONEY_ZERO,
              credit: MONEY_ZERO,
            };
            const sum = addMoney(held[line.side], line.amount);
            if (!sum.ok) {
              return Promise.resolve(sum);
            }
            totals.set(line.account, { ...held, [line.side]: sum.value });
          }
        }
      }
      return Promise.resolve(ok([...totals.values()]));
    },
    titledEntries: (userId, createdSince) =>
      Promise.resolve(
        ok(
          shownOf(userId).filter(
            (entry) => entry.title !== '' && entry.createdAt.getTime() >= createdSince.getTime(),
          ),
        ),
      ),
  };
}

export function inMemoryEntries(inTransaction: Partial<EntryRepository> = {}): InMemoryEntries {
  const rows: StoredEntry[] = [];
  return {
    rows,
    entries: repositoryOver(rows),
    unitOfWork: {
      run: async (work) => {
        const working = [...rows];
        const done = await work({ ...repositoryOver(working), ...inTransaction });
        if (done.ok) {
          rows.splice(0, rows.length, ...working);
        }
        return done;
      },
    },
  };
}
