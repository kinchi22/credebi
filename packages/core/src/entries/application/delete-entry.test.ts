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
import { type Reversal } from '../domain/reversal';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';
import { createDeleteEntry } from './delete-entry';
import { inMemoryEntries } from './in-memory-entries';
import { createPostEntry } from './post-entry';
import { createSearchEntries } from './search-entries';

const inMemoryRepository = (): EntryRepository => inMemoryEntries().entries;

function recordingReversals(): {
  readonly entries: EntryRepository;
  readonly reversals: Reversal[];
} {
  const entries = inMemoryRepository();
  const reversals: Reversal[] = [];
  return {
    entries: {
      ...entries,
      saveReversal: (userId, reversal) => {
        reversals.push(reversal);
        return entries.saveReversal(userId, reversal);
      },
    },
    reversals,
  };
}

const NOW = new Date('2026-10-04T09:00:00.000Z');

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;

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

const CHART = [account(CASH, 'asset', 'Cash'), account(EXPENSES, 'expense', 'Expenses')];

const DRAFT: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [
    { account: EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: CASH, side: 'credit', amount: 12500 as Money },
  ],
};

function books(entries: EntryRepository = inMemoryRepository()): {
  readonly post: (auth: AuthContext, memo: string) => Promise<Entry>;
  readonly deleteEntry: ReturnType<typeof createDeleteEntry>;
  readonly memos: (auth: AuthContext) => Promise<readonly string[]>;
} {
  let sequence = 0;
  const newEntryId = (): EntryId => {
    sequence += 1;
    return `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId;
  };
  const now = (): Date => NOW;
  const { accounts, hold } = inMemoryAccounts();
  hold(ADA_ID, CHART);
  hold(GRACE_ID, CHART);
  const postEntry = createPostEntry({ entries, accounts, newEntryId, now });
  const searchEntries = createSearchEntries({ entries, accounts });
  return {
    post: async (auth, memo) => {
      const posted = await postEntry(auth, { ...DRAFT, memo });
      expect(isOk(posted), 'test setup posted an entry that breaks a rule').toBe(true);
      return isOk(posted) ? posted.value : ({} as Entry);
    },
    deleteEntry: createDeleteEntry({ entries, newEntryId, now }),
    memos: async (auth) => {
      const found = await searchEntries(auth, NO_CRITERIA);
      return isOk(found) ? found.value.map((entry) => entry.memo) : [];
    },
  };
}

const UNKNOWN_ID = '01920000-0000-7000-8000-0000000000ff' as EntryId;

describe('createDeleteEntry', () => {
  it('hides the Entry from Entry search and leaves the others', async () => {
    const { post, deleteEntry, memos } = books();
    const doomed = await post(ADA, 'Posted by mistake');
    await post(ADA, 'Kept');

    expect(await deleteEntry(ADA, doomed.id)).toEqual(ok(undefined));
    expect(await memos(ADA)).toEqual(['Kept']);
  });

  it('posts a Reversal of the Entry: its lines with each Side swapped, on its day, under its memo', async () => {
    const { entries, reversals } = recordingReversals();
    const { post, deleteEntry } = books(entries);
    const doomed = await post(ADA, 'Posted by mistake');

    await deleteEntry(ADA, doomed.id);

    expect(reversals).toEqual([
      {
        id: expect.not.stringMatching(doomed.id) as unknown,
        reverses: doomed.id,
        entryDate: doomed.entryDate,
        memo: doomed.memo,
        total: doomed.total,
        createdAt: NOW,
        lines: [
          { account: EXPENSES, accountName: 'Expenses', side: 'credit', amount: 12500 },
          { account: CASH, accountName: 'Cash', side: 'debit', amount: 12500 },
        ],
      },
    ]);
  });

  it('refuses nobody, as unauthenticated, and deletes nothing', async () => {
    const { post, deleteEntry, memos } = books();
    const kept = await post(ADA, 'Kept');

    const deleted = await deleteEntry(SIGNED_OUT, kept.id);

    expect(isErr(deleted) && deleted.error.code).toBe('UNAUTHENTICATED');
    expect(await memos(ADA)).toEqual(['Kept']);
  });

  it('answers not found for an id no Entry has', async () => {
    const { deleteEntry } = books();

    const deleted = await deleteEntry(ADA, UNKNOWN_ID);

    expect(isErr(deleted) && deleted.error.code).toBe('NOT_FOUND');
  });

  it("answers not found for another User's Entry, and leaves it in their books", async () => {
    const { post, deleteEntry, memos } = books();
    const graces = await post(GRACE, 'Grace');

    const deleted = await deleteEntry(ADA, graces.id);

    expect(isErr(deleted) && deleted.error.code).toBe('NOT_FOUND');
    expect(await memos(GRACE)).toEqual(['Grace']);
  });

  it('answers not found for a Reversal, which is never reversed', async () => {
    const { entries, reversals } = recordingReversals();
    const { post, deleteEntry } = books(entries);
    const doomed = await post(ADA, 'Posted by mistake');
    await deleteEntry(ADA, doomed.id);
    const [reversal] = reversals;

    const deleted = await deleteEntry(ADA, reversal?.id ?? UNKNOWN_ID);

    expect(reversal).toBeDefined();
    expect(isErr(deleted) && deleted.error.code).toBe('NOT_FOUND');
  });

  it('answers conflict for an Entry reversed already, and posts no second Reversal', async () => {
    const { post, deleteEntry, memos } = books();
    const doomed = await post(ADA, 'Posted by mistake');
    await deleteEntry(ADA, doomed.id);

    const again = await deleteEntry(ADA, doomed.id);

    expect(isErr(again) && again.error).toEqual({
      code: 'CONFLICT',
      message: expect.stringContaining(doomed.id) as unknown,
    });
    expect(await memos(ADA)).toEqual([]);
  });

  it('answers dependency unavailable when the Entry cannot be read', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { deleteEntry } = books({
      ...inMemoryRepository(),
      find: () => Promise.resolve(err(down)),
    });

    expect(await deleteEntry(ADA, UNKNOWN_ID)).toEqual(err(down));
  });

  it('answers dependency unavailable when the Reversal cannot be saved, and the Entry stays', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const entries = inMemoryRepository();
    const { post, deleteEntry, memos } = books({
      ...entries,
      saveReversal: () => Promise.resolve(err(down)),
    });
    const kept = await post(ADA, 'Kept');

    expect(await deleteEntry(ADA, kept.id)).toEqual(err(down));
    expect(await memos(ADA)).toEqual(['Kept']);
  });

  it('lets only one of two Deletes of one Entry at once succeed, and the other answers conflict', async () => {
    const { post, deleteEntry, memos } = books();
    const doomed = await post(ADA, 'Posted by mistake');

    const deletions = await Promise.all([deleteEntry(ADA, doomed.id), deleteEntry(ADA, doomed.id)]);

    expect(deletions.map((deleted) => (isErr(deleted) ? deleted.error.code : 'OK'))).toEqual([
      'OK',
      'CONFLICT',
    ]);
    expect(await memos(ADA)).toEqual([]);
  });
});
