import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type DomainError,
  type EntryId,
  type Money,
  type Result,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository, type FoundEntry } from '../ports/entry-repository';
import { type UnitOfWork } from '../ports/unit-of-work';
import { createDeleteEntry } from './delete-entry';
import { createEditEntry } from './edit-entry';
import { createPostEntry } from './post-entry';
import { createSearchEntries } from './search-entries';

type Row = {
  readonly userId: UserId;
  readonly entry: Entry;
  readonly reverses?: EntryId;
};

function repositoryOver(rows: Row[]): EntryRepository {
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

type InMemoryBooks = {
  readonly rows: readonly Row[];
  readonly entries: EntryRepository;
  readonly unitOfWork: UnitOfWork;
};

function inMemoryBooks(inTransaction: Partial<EntryRepository> = {}): InMemoryBooks {
  const rows: Row[] = [];
  return {
    rows,
    entries: repositoryOver(rows),
    unitOfWork: async (work) => {
      const working = [...rows];
      const done = await work({ ...repositoryOver(working), ...inTransaction });
      if (done.ok) {
        rows.splice(0, rows.length, ...working);
      }
      return done;
    },
  };
}

const NOW = new Date('2026-10-04T09:00:00.000Z');

const ADA: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a1' as UserId };
const GRACE: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a2' as UserId };

const DRAFT: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [
    { account: 'expense', side: 'debit', amount: 12500 as Money },
    { account: 'cash', side: 'credit', amount: 12500 as Money },
  ],
};

const REWRITTEN: EntryDraft = {
  entryDate: '2026-09-20',
  memo: 'Office supplies on account',
  lines: [
    { account: 'expense', side: 'debit', amount: 8000 as Money },
    { account: 'payable', side: 'credit', amount: 8000 as Money },
  ],
};

const UNKNOWN_ID = '01920000-0000-7000-8000-0000000000ff' as EntryId;

function useCases(books: InMemoryBooks = inMemoryBooks()): {
  readonly rows: readonly Row[];
  readonly post: (auth: AuthContext, memo: string) => Promise<Entry>;
  readonly editEntry: ReturnType<typeof createEditEntry>;
  readonly deleteEntry: ReturnType<typeof createDeleteEntry>;
  readonly visible: (auth: AuthContext) => Promise<readonly Entry[]>;
} {
  let sequence = 0;
  const newEntryId = (): EntryId => {
    sequence += 1;
    return `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId;
  };
  const now = (): Date => NOW;
  const postEntry = createPostEntry({ entries: books.entries, newEntryId, now });
  const searchEntries = createSearchEntries({ entries: books.entries });
  return {
    rows: books.rows,
    post: async (auth, memo) => {
      const posted = await postEntry(auth, { ...DRAFT, memo });
      expect(isOk(posted), 'test setup posted an entry that breaks a rule').toBe(true);
      return isOk(posted) ? posted.value : ({} as Entry);
    },
    editEntry: createEditEntry({ ...books, newEntryId, now }),
    deleteEntry: createDeleteEntry({ entries: books.entries, newEntryId, now }),
    visible: async (auth) => {
      const found = await searchEntries(auth, NO_CRITERIA);
      return isOk(found) ? found.value : [];
    },
  };
}

const memos = (entries: readonly Entry[]): readonly string[] => entries.map((entry) => entry.memo);

describe('createEditEntry', () => {
  it('leaves exactly the replacement visible to Entry search, in place of the Entry, and answers with it', async () => {
    const { post, editEntry, visible } = useCases();
    const original = await post(ADA, 'Office supplies');
    await post(ADA, 'Kept');

    const edited = await editEntry(ADA, original.id, REWRITTEN);

    expect(isOk(edited)).toBe(true);
    if (!isOk(edited)) return;
    expect(edited.value).toEqual({
      id: expect.not.stringMatching(original.id) as unknown,
      entryDate: '2026-09-20',
      memo: 'Office supplies on account',
      lines: REWRITTEN.lines,
      total: 8000,
      createdAt: NOW,
    });
    expect(await visible(ADA)).toEqual([
      expect.objectContaining({ memo: 'Kept' }),
      edited.value,
    ]);
  });

  it('posts a Reversal of the Entry and the replacement, and nothing else', async () => {
    const { rows, post, editEntry } = useCases();
    const original = await post(ADA, 'Office supplies');

    const edited = await editEntry(ADA, original.id, REWRITTEN);

    expect(rows.slice(1)).toEqual([
      {
        userId: ADA.userId,
        reverses: original.id,
        entry: {
          id: expect.not.stringMatching(original.id) as unknown,
          reverses: original.id,
          entryDate: original.entryDate,
          memo: original.memo,
          total: original.total,
          createdAt: NOW,
          lines: [
            { account: 'expense', side: 'credit', amount: 12500 },
            { account: 'cash', side: 'debit', amount: 12500 },
          ],
        },
      },
      { userId: ADA.userId, entry: isOk(edited) ? edited.value : undefined },
    ]);
  });

  it('writes nothing for a draft that changes nothing, and answers with the Entry as it is', async () => {
    const { rows, post, editEntry, visible } = useCases();
    const original = await post(ADA, 'Office supplies');

    const edited = await editEntry(ADA, original.id, { ...DRAFT, memo: '  Office supplies ' });

    expect(edited).toEqual(ok(original));
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });

  it('edits a replacement in turn', async () => {
    const { post, editEntry, visible } = useCases();
    const original = await post(ADA, 'First');
    const once = await editEntry(ADA, original.id, { ...DRAFT, memo: 'Second' });
    const replacement = isOk(once) ? once.value.id : UNKNOWN_ID;

    const twice = await editEntry(ADA, replacement, { ...REWRITTEN, memo: 'Third' });

    expect(isOk(twice)).toBe(true);
    expect(memos(await visible(ADA))).toEqual(['Third']);
  });

  it('refuses nobody, as unauthenticated, and writes nothing', async () => {
    const { rows, post, editEntry } = useCases();
    const original = await post(ADA, 'Office supplies');

    const edited = await editEntry(SIGNED_OUT, original.id, REWRITTEN);

    expect(isErr(edited) && edited.error.code).toBe('UNAUTHENTICATED');
    expect(rows).toHaveLength(1);
  });

  it('refuses a draft that breaks an Entry rule as posting does, and leaves the Entry', async () => {
    const { rows, post, editEntry, visible } = useCases();
    const original = await post(ADA, 'Office supplies');
    const blank = await editEntry(ADA, original.id, { ...REWRITTEN, memo: '   ' });
    const unbalanced = await editEntry(ADA, original.id, {
      ...REWRITTEN,
      lines: [
        { account: 'expense', side: 'debit', amount: 8000 as Money },
        { account: 'payable', side: 'credit', amount: 7999 as Money },
      ],
    });

    expect(isErr(blank) && blank.error.code).toBe('INVALID_INPUT');
    expect(isErr(unbalanced) && unbalanced.error.code).toBe('UNBALANCED');
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });

  it('answers not found for an id no Entry has', async () => {
    const { editEntry } = useCases();

    const edited = await editEntry(ADA, UNKNOWN_ID, REWRITTEN);

    expect(isErr(edited) && edited.error.code).toBe('NOT_FOUND');
  });

  it("answers not found for another User's Entry, and leaves it in their books", async () => {
    const { rows, post, editEntry, visible } = useCases();
    const graces = await post(GRACE, 'Grace');

    const edited = await editEntry(ADA, graces.id, REWRITTEN);

    expect(isErr(edited) && edited.error.code).toBe('NOT_FOUND');
    expect(rows).toHaveLength(1);
    expect(await visible(GRACE)).toEqual([graces]);
  });

  it('answers not found for a Reversal', async () => {
    const { rows, post, editEntry, deleteEntry } = useCases();
    const original = await post(ADA, 'Posted by mistake');
    await deleteEntry(ADA, original.id);
    const reversal = rows[1]?.entry.id ?? UNKNOWN_ID;

    const edited = await editEntry(ADA, reversal, REWRITTEN);

    expect(isErr(edited) && edited.error.code).toBe('NOT_FOUND');
    expect(rows).toHaveLength(2);
  });

  it('answers conflict for an Entry reversed already, though the draft changes nothing, and writes nothing', async () => {
    const { rows, post, editEntry, deleteEntry } = useCases();
    const original = await post(ADA, 'Office supplies');
    await deleteEntry(ADA, original.id);

    for (const draft of [REWRITTEN, DRAFT]) {
      const edited = await editEntry(ADA, original.id, draft);
      expect(isErr(edited) && edited.error).toEqual({
        code: 'CONFLICT',
        message: expect.stringContaining(original.id) as unknown,
      });
    }
    expect(rows).toHaveLength(2);
  });

  it('answers dependency unavailable when the Entry cannot be read', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const books = inMemoryBooks();
    const { editEntry } = useCases({
      ...books,
      entries: { ...books.entries, find: () => Promise.resolve(err(down)) },
    });

    expect(await editEntry(ADA, UNKNOWN_ID, REWRITTEN)).toEqual(err(down));
  });

  it('leaves the Entry visible and writes nothing when the replacement cannot be saved', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { rows, post, editEntry, visible } = useCases(
      inMemoryBooks({ save: () => Promise.resolve(err(down)) }),
    );
    const original = await post(ADA, 'Office supplies');

    expect(await editEntry(ADA, original.id, REWRITTEN)).toEqual(err(down));
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });

  it('saves no replacement when the Reversal is refused', async () => {
    const refused = domainError('CONFLICT', 'Reversed already.');
    const saved: Entry[] = [];
    const { rows, post, editEntry, visible } = useCases(
      inMemoryBooks({
        saveReversal: () => Promise.resolve(err(refused)),
        save: (_userId, entry) => {
          saved.push(entry);
          return Promise.resolve(ok(undefined));
        },
      }),
    );
    const original = await post(ADA, 'Office supplies');

    expect(await editEntry(ADA, original.id, REWRITTEN)).toEqual(err(refused));
    expect(saved).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });
});
