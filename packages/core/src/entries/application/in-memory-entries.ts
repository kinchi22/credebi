import {
  domainError,
  err,
  ok,
  type DomainError,
  type EntryId,
  type Result,
  type UserId,
} from '@repo/contracts';
import { type Entry } from '../domain/entry';
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
    search: (userId) =>
      Promise.resolve(
        ok(
          rows
            .filter(
              (row) =>
                row.userId === userId && row.reverses === undefined && !reversed(row.entry.id),
            )
            .map((row) => row.entry),
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
