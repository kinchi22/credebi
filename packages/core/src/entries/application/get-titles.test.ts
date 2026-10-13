import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isOk,
  type AccountId,
  type EntryId,
  type Money,
  type UserId,
} from '@repo/contracts';
import { inMemoryAccounts } from '../../accounts/application/in-memory-accounts';
import { type Account } from '../../accounts/domain/account';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry, type EntryDraft } from '../domain/entry';
import { createDeleteEntry } from './delete-entry';
import { createEditEntry } from './edit-entry';
import { createGetTitles } from './get-titles';
import { inMemoryEntries } from './in-memory-entries';
import { createPostEntry } from './post-entry';

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

const draft = (title: string, entryDate = '2026-09-15'): EntryDraft => ({
  entryDate,
  title,
  memo: '',
  lines: [
    { account: EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: CASH, side: 'credit', amount: 12500 as Money },
  ],
});

const NOW = new Date('2026-10-04T10:00:00.000Z');
const WINDOW_START = new Date('2024-10-04T10:00:00.000Z');
const JUST_BEFORE_WINDOW = new Date(WINDOW_START.getTime() - 1);

type Posting = {
  readonly entryDate?: string;
  readonly createdAt?: Date;
};

function books(): {
  readonly post: (auth: AuthContext, title: string, posting?: Posting) => Promise<Entry>;
  readonly edit: (auth: AuthContext, entry: Entry, title: string) => Promise<void>;
  readonly remove: (auth: AuthContext, entry: Entry) => Promise<void>;
  readonly titles: ReturnType<typeof createGetTitles>;
} {
  let sequence = 0;
  let postingAt: Date | undefined;
  const newEntryId = (): EntryId => {
    sequence += 1;
    return `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId;
  };
  const now = (): Date => postingAt ?? new Date(Date.UTC(2026, 9, 4, 9, 0, sequence));
  const { accounts, hold } = inMemoryAccounts();
  hold(ADA_ID, CHART);
  hold(GRACE_ID, CHART);
  const { entries, unitOfWork } = inMemoryEntries();
  const postEntry = createPostEntry({ entries, accounts, newEntryId, now });
  const editEntry = createEditEntry({ entries, accounts, unitOfWork, newEntryId, now });
  const deleteEntry = createDeleteEntry({ entries, newEntryId, now });

  return {
    post: async (auth, title, { entryDate, createdAt } = {}) => {
      postingAt = createdAt;
      const posted = await postEntry(auth, draft(title, entryDate));
      postingAt = undefined;
      if (!posted.ok) {
        throw new Error(posted.error.message);
      }
      return posted.value;
    },
    edit: async (auth, entry, title) => {
      const edited = await editEntry(auth, entry.id, draft(title, entry.entryDate));
      if (!edited.ok) {
        throw new Error(edited.error.message);
      }
    },
    remove: async (auth, entry) => {
      const deleted = await deleteEntry(auth, entry.id);
      if (!deleted.ok) {
        throw new Error(deleted.error.message);
      }
    },
    titles: createGetTitles({ entries, now: () => NOW }),
  };
}

const offered = async (
  titles: ReturnType<typeof createGetTitles>,
  auth: AuthContext,
): Promise<readonly string[] | false> => {
  const answered = await titles(auth);
  return isOk(answered) && answered.value.map(({ title }) => title);
};

describe('createGetTitles', () => {
  it('answers the Titles of the User, the most recently posted first whatever its day', async () => {
    const { post, titles } = books();
    await post(ADA, 'Starbucks', { entryDate: '2026-09-15' });
    await post(ADA, 'Salary', { entryDate: '2026-09-10' });
    await post(ADA, 'Rent', { entryDate: '2026-09-20' });

    expect(await offered(titles, ADA)).toEqual(['Rent', 'Salary', 'Starbucks']);
  });

  it('answers Titles differing only in case once, spelled as on the latest Entry carrying it', async () => {
    const { post, titles } = books();
    await post(ADA, 'Starbucks');
    await post(ADA, 'Salary');
    await post(ADA, 'starbucks');

    expect(await offered(titles, ADA)).toEqual(['starbucks', 'Salary']);
  });

  it('answers nothing for an Entry with no Title', async () => {
    const { post, titles } = books();
    await post(ADA, '');
    await post(ADA, '   ');
    await post(ADA, 'Rent');

    expect(await offered(titles, ADA)).toEqual(['Rent']);
  });

  it('answers no Title carried only by a deleted Entry', async () => {
    const { post, remove, titles } = books();
    const gone = await post(ADA, 'Gone');
    await post(ADA, 'Kept');
    await remove(ADA, gone);

    expect(await offered(titles, ADA)).toEqual(['Kept']);
  });

  it('answers the Title an Entry is corrected to, and not the one corrected away', async () => {
    const { post, edit, titles } = books();
    const misspelt = await post(ADA, 'Strabucks');
    await post(ADA, 'Kept');
    await edit(ADA, misspelt, 'Starbucks');

    expect(await offered(titles, ADA)).toEqual(['Starbucks', 'Kept']);
  });

  it("answers the User's own Titles, and never another's", async () => {
    const { post, titles } = books();
    await post(ADA, 'Secret');
    await post(GRACE, 'Mine');

    expect(await offered(titles, GRACE)).toEqual(['Mine']);
  });

  it('offers a Title carried by an Entry created two years before now to the instant, and not one created before that', async () => {
    const { post, titles } = books();
    await post(ADA, 'Gym', { createdAt: JUST_BEFORE_WINDOW });
    await post(ADA, 'Pool', { createdAt: WINDOW_START });

    expect(await offered(titles, ADA)).toEqual(['Pool']);
  });

  it('offers a Title still carried by one Entry created within two years, though older Entries carry it too', async () => {
    const { post, titles } = books();
    await post(ADA, 'Gym', { createdAt: JUST_BEFORE_WINDOW });
    await post(ADA, 'gym', { createdAt: new Date('2026-01-01T00:00:00.000Z') });

    expect(await offered(titles, ADA)).toEqual(['gym']);
  });

  it("judges the window by when an Entry was created, never by the Entry's day", async () => {
    const { post, titles } = books();
    await post(ADA, 'Backdated', { entryDate: '2026-01-01' });
    await post(ADA, 'Stale', { entryDate: '2026-09-30', createdAt: JUST_BEFORE_WINDOW });

    expect(await offered(titles, ADA)).toEqual(['Backdated']);
  });

  it('offers the Title of an old Entry corrected within two years, the Correction counting as created when posted', async () => {
    const { post, edit, titles } = books();
    const old = await post(ADA, 'Gym', { createdAt: JUST_BEFORE_WINDOW });
    await edit(ADA, old, 'Gym class');

    expect(await offered(titles, ADA)).toEqual(['Gym class']);
  });

  it("answers with each Title the Accounts its Entries name on each Side", async () => {
    const { post, titles } = books();
    await post(ADA, 'Rent');

    const answered = await titles(ADA);

    expect(answered.ok && answered.value.map(({ suggested }) => suggested)).toEqual([
      { debit: [EXPENSES], credit: [CASH] },
    ]);
  });

  it('passes a repository failure through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { entries } = inMemoryEntries();
    const titles = createGetTitles({
      entries: { ...entries, titledEntries: () => Promise.resolve(err(down)) },
      now: () => NOW,
    });

    expect(await titles(ADA)).toEqual(err(down));
  });

  it('refuses to answer for nobody, as unauthenticated', async () => {
    const { post, titles } = books();
    await post(ADA, 'Salary');

    const answered = await titles(SIGNED_OUT);

    expect(!answered.ok && answered.error.code).toBe('UNAUTHENTICATED');
  });
});
