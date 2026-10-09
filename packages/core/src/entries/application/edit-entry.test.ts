import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type AccountId,
  type EntryId,
  type Money,
  type UserId,
} from '@repo/contracts';
import { inMemoryAccounts } from '../../accounts/application/in-memory-accounts';
import { type Account } from '../../accounts/domain/account';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { createDeleteEntry } from './delete-entry';
import { createEditEntry } from './edit-entry';
import { inMemoryEntries, type InMemoryEntries, type StoredEntry } from './in-memory-entries';
import { createPostEntry } from './post-entry';
import { createSearchEntries } from './search-entries';

const NOW = new Date('2026-10-04T09:00:00.000Z');

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const PAYABLE = '01920000-0000-7000-8000-00000000c002' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const GRACES_CASH = '01920000-0000-7000-8000-00000000d001' as AccountId;
const GRACES_EXPENSES = '01920000-0000-7000-8000-00000000d005' as AccountId;

const account = (id: AccountId, accountType: Account['accountType'], name: string): Account => ({
  id,
  accountType,
  groupId: null,
  name,
  description: null,
  position: 0,
  activeFrom: '2026-01-01',
  activeUntil: null,
});

const DRAFT: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [
    { account: EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: CASH, side: 'credit', amount: 12500 as Money },
  ],
};

const GRACES_DRAFT: EntryDraft = {
  ...DRAFT,
  lines: [
    { account: GRACES_EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: GRACES_CASH, side: 'credit', amount: 12500 as Money },
  ],
};

const REWRITTEN: EntryDraft = {
  entryDate: '2026-09-20',
  memo: 'Office supplies on account',
  lines: [
    { account: EXPENSES, side: 'debit', amount: 8000 as Money },
    { account: PAYABLE, side: 'credit', amount: 8000 as Money },
  ],
};

const UNKNOWN_ID = '01920000-0000-7000-8000-0000000000ff' as EntryId;

function useCases(books: InMemoryEntries = inMemoryEntries()): {
  readonly rows: readonly StoredEntry[];
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
  const { accounts, hold } = inMemoryAccounts();
  hold(ADA_ID, [
    account(CASH, 'asset', 'Cash'),
    account(PAYABLE, 'liability', 'Accounts payable'),
    account(EXPENSES, 'expense', 'Expenses'),
  ]);
  hold(GRACE_ID, [
    account(GRACES_CASH, 'asset', 'Cash'),
    account(GRACES_EXPENSES, 'expense', 'Expenses'),
  ]);
  const postEntry = createPostEntry({ entries: books.entries, accounts, newEntryId, now });
  const searchEntries = createSearchEntries({ entries: books.entries, accounts });
  return {
    rows: books.rows,
    post: async (auth, memo) => {
      const posted = await postEntry(auth, { ...(auth === GRACE ? GRACES_DRAFT : DRAFT), memo });
      expect(isOk(posted), 'test setup posted an entry that breaks a rule').toBe(true);
      return isOk(posted) ? posted.value : ({} as Entry);
    },
    editEntry: createEditEntry({ ...books, accounts, newEntryId, now }),
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
      lines: [
        { account: EXPENSES, accountName: 'Expenses', side: 'debit', amount: 8000 },
        { account: PAYABLE, accountName: 'Accounts payable', side: 'credit', amount: 8000 },
      ],
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
            { account: EXPENSES, accountName: 'Expenses', side: 'credit', amount: 12500 },
            { account: CASH, accountName: 'Cash', side: 'debit', amount: 12500 },
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
        { account: EXPENSES, side: 'debit', amount: 8000 as Money },
        { account: PAYABLE, side: 'credit', amount: 7999 as Money },
      ],
    });

    expect(isErr(blank) && blank.error.code).toBe('INVALID_INPUT');
    expect(isErr(unbalanced) && unbalanced.error.code).toBe('UNBALANCED');
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });

  it("refuses a replacement naming another User's Account, and leaves the Entry", async () => {
    const { rows, post, editEntry, visible } = useCases();
    const original = await post(ADA, 'Office supplies');

    const edited = await editEntry(ADA, original.id, {
      ...REWRITTEN,
      lines: [
        { account: EXPENSES, side: 'debit', amount: 8000 as Money },
        { account: GRACES_CASH, side: 'credit', amount: 8000 as Money },
      ],
    });

    expect(isErr(edited) && edited.error.code).toBe('INVALID_INPUT');
    expect(rows).toHaveLength(1);
    expect(await visible(ADA)).toEqual([original]);
  });

  it('answers not found for an id no Entry has, though the draft breaks a rule too', async () => {
    const { editEntry } = useCases();

    for (const draft of [REWRITTEN, { ...REWRITTEN, memo: '' }]) {
      const edited = await editEntry(ADA, UNKNOWN_ID, draft);
      expect(isErr(edited) && edited.error.code).toBe('NOT_FOUND');
    }
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

  it('answers conflict for an Entry reversed already, whether the draft changes nothing or breaks a rule, and writes nothing', async () => {
    const { rows, post, editEntry, deleteEntry } = useCases();
    const original = await post(ADA, 'Office supplies');
    await deleteEntry(ADA, original.id);

    for (const draft of [REWRITTEN, DRAFT, { ...REWRITTEN, memo: '' }]) {
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
    const books = inMemoryEntries();
    const { editEntry } = useCases({
      ...books,
      entries: { ...books.entries, find: () => Promise.resolve(err(down)) },
    });

    expect(await editEntry(ADA, UNKNOWN_ID, REWRITTEN)).toEqual(err(down));
  });

  it('writes nothing when the chart of accounts cannot be read', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const books = inMemoryEntries();
    const { rows, post } = useCases(books);
    const original = await post(ADA, 'Office supplies');
    const editEntry = createEditEntry({
      ...books,
      accounts: { ...inMemoryAccounts().accounts, readChart: () => Promise.resolve(err(down)) },
      newEntryId: () => UNKNOWN_ID,
      now: () => NOW,
    });

    expect(await editEntry(ADA, original.id, REWRITTEN)).toEqual(err(down));
    expect(rows).toHaveLength(1);
  });

  it('leaves the Entry visible and writes nothing when the replacement cannot be saved', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { rows, post, editEntry, visible } = useCases(
      inMemoryEntries({ save: () => Promise.resolve(err(down)) }),
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
      inMemoryEntries({
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
