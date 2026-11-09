import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type AccountId,
  type ConnectionId,
  type DomainError,
  type EntryId,
  type Money,
  type Result,
  type UserId,
} from '@repo/contracts';
import { inMemoryAccounts } from '../../accounts/application/in-memory-accounts';
import { type Account } from '../../accounts/domain/account';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';
import { type RequestKeyRepository } from '../ports/request-key-repository';
import { type UnitOfWork } from '../ports/unit-of-work';
import { createDeleteEntry } from './delete-entry';
import { inMemoryEntries as inMemoryBooks, type InMemoryEntries } from './in-memory-entries';
import { createSearchEntries, type SearchEntries } from './search-entries';
import { createPostEntry, type PostEntry } from './post-entry';

function inMemoryEntries(): EntryRepository {
  const stored: { readonly userId: UserId; readonly entry: Entry }[] = [];
  return {
    save: (userId: UserId, entry: Entry): Promise<Result<void, DomainError>> => {
      stored.push({ userId, entry });
      return Promise.resolve(ok(undefined));
    },
    saveReversal: () => Promise.resolve(err(domainError('CONFLICT', 'Not posted here.'))),
    find: () => Promise.resolve(err(domainError('NOT_FOUND', 'Not read here.'))),
    search: (userId: UserId): Promise<Result<readonly Entry[], DomainError>> =>
      Promise.resolve(
        ok(stored.filter((row) => row.userId === userId).map((row) => row.entry)),
      ),
    accountTotals: () => Promise.resolve(err(domainError('NOT_FOUND', 'Not read here.'))),
    monthlyAccountTotals: () => Promise.resolve(err(domainError('NOT_FOUND', 'Not read here.'))),
    titledEntries: () => Promise.resolve(err(domainError('NOT_FOUND', 'Not read here.'))),
  };
}

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
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

function charts(): AccountRepository {
  const { accounts, hold } = inMemoryAccounts();
  hold(ADA_ID, [account(CASH, 'asset', 'Cash'), account(EXPENSES, 'expense', 'Expenses')]);
  hold(GRACE_ID, [
    account(GRACES_CASH, 'asset', 'Cash'),
    account(GRACES_EXPENSES, 'expense', 'Expenses'),
  ]);
  return accounts;
}

const unavailableEntries: EntryRepository = {
  save: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  saveReversal: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  find: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  search: () => Promise.resolve(ok([])),
  accountTotals: () => Promise.resolve(ok([])),
  monthlyAccountTotals: () => Promise.resolve(ok({ opening: [], months: [] })),
  titledEntries: () => Promise.resolve(ok([])),
};

const ENTRY_ID = '01920000-0000-7000-8000-000000000001' as EntryId;
const CREATED_AT = new Date('2026-09-15T00:30:00.000Z');

const draft = (debit: number, credit: number): EntryDraft => ({
  entryDate: '2026-09-15',
  title: ' Stationers ',
  memo: 'Office supplies',
  lines: [
    { account: EXPENSES, side: 'debit', amount: debit as Money },
    { account: CASH, side: 'credit', amount: credit as Money },
  ],
});

function useCases(
  entries: EntryRepository,
  accounts: AccountRepository = charts(),
): {
  postEntry: PostEntry;
  searchEntries: SearchEntries;
} {
  return {
    postEntry: createPostEntry({
      entries,
      accounts,
      unitOfWork: inMemoryBooks().unitOfWork,
      newEntryId: () => ENTRY_ID,
      now: () => CREATED_AT,
    }),
    searchEntries: createSearchEntries({ entries, accounts }),
  };
}

describe('createPostEntry', () => {
  it('stores a balanced entry, stamped with the injected id and clock, with its Title trimmed, where it is found', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(posted.value.id).toBe(ENTRY_ID);
    expect(posted.value.createdAt).toEqual(CREATED_AT);
    expect(posted.value.total).toBe(12500);
    expect(posted.value.title).toBe('Stationers');
    expect(posted.value.lines).toEqual([
      { account: EXPENSES, accountName: 'Expenses', side: 'debit', amount: 12500 },
      { account: CASH, accountName: 'Cash', side: 'credit', amount: 12500 },
    ]);

    const found = await searchEntries(ADA, NO_CRITERIA);
    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([posted.value]);
  });

  it('refuses an unbalanced entry and stores nothing', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12000));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('UNBALANCED');

    const found = await searchEntries(ADA, NO_CRITERIA);
    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([]);
  });

  it("refuses a line naming another User's Account, as invalid input, and stores nothing", async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, {
      ...draft(12500, 12500),
      lines: [
        { account: EXPENSES, side: 'debit', amount: 12500 as Money },
        { account: GRACES_CASH, side: 'credit', amount: 12500 as Money },
      ],
    });

    expect(isErr(posted) && posted.error.code).toBe('INVALID_INPUT');
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([]));
    expect(await searchEntries(GRACE, NO_CRITERIA)).toEqual(ok([]));
  });

  it('refuses, as invalid input, an entry dated outside the Active period of an Account it names, and stores nothing', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, { ...draft(12500, 12500), entryDate: '2025-12-31' });

    expect(isErr(posted) && posted.error).toEqual(
      domainError(
        'INVALID_INPUT',
        'Account "Cash" is not active on 2025-12-31, outside its Active period.',
      ),
    );
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([]));
  });

  it('posts an entry dated on the first day of the Active period of every Account it names', async () => {
    const { postEntry } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, { ...draft(12500, 12500), entryDate: '2026-01-01' });

    expect(isOk(posted) && posted.value.entryDate).toBe('2026-01-01');
  });

  it('reports a failure to read the chart of accounts as its own result, and stores nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const entries = inMemoryEntries();
    const { postEntry } = useCases(entries, { ...inMemoryAccounts().accounts, readChart: () => Promise.resolve(err(down)) });

    expect(await postEntry(ADA, draft(12500, 12500))).toEqual(err(down));
    expect(await useCases(entries).searchEntries(ADA, NO_CRITERIA)).toEqual(ok([]));
  });

  it('reports a failed save as its own result, rather than the entry it could not keep', async () => {
    const { postEntry } = useCases(unavailableEntries);

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it("stores the entry as the signed-in User's, where no other User finds it", async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([posted.value]));
    expect(await searchEntries(GRACE, NO_CRITERIA)).toEqual(ok([]));
  });

  it('refuses to post for nobody, as unauthenticated, and stores nothing', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(SIGNED_OUT, draft(12500, 12000));

    expect(isErr(posted) && posted.error.code).toBe('UNAUTHENTICATED');
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([]));
  });
});

const PHONE = '01920000-0000-7000-8000-0000000000e1' as ConnectionId;
const LAPTOP = '01920000-0000-7000-8000-0000000000e2' as ConnectionId;
const ADA_ON_PHONE: AuthContext = { userId: ADA_ID, scopes: ['write'], connectionId: PHONE };
const ADA_ON_LAPTOP: AuthContext = { userId: ADA_ID, scopes: ['write'], connectionId: LAPTOP };
const GRACE_ON_PHONE: AuthContext = { userId: GRACE_ID, scopes: ['write'], connectionId: PHONE };

const KEY = 'coffee-2026-09-15';

const GRACES_DRAFT: EntryDraft = {
  ...draft(12500, 12500),
  lines: [
    { account: GRACES_EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: GRACES_CASH, side: 'credit', amount: 12500 as Money },
  ],
};

function keyedUseCases(
  books: InMemoryEntries = inMemoryBooks(),
  unitOfWork: UnitOfWork = books.unitOfWork,
): {
  readonly books: InMemoryEntries;
  readonly postEntry: PostEntry;
  readonly deleteEntry: ReturnType<typeof createDeleteEntry>;
  readonly visible: (auth: AuthContext) => Promise<readonly Entry[]>;
} {
  let sequence = 0;
  const newEntryId = (): EntryId => {
    sequence += 1;
    return `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId;
  };
  const accounts = charts();
  const searchEntries = createSearchEntries({ entries: books.entries, accounts });
  return {
    books,
    postEntry: createPostEntry({
      entries: books.entries,
      accounts,
      unitOfWork,
      newEntryId,
      now: () => CREATED_AT,
    }),
    deleteEntry: createDeleteEntry({ entries: books.entries, newEntryId, now: () => CREATED_AT }),
    visible: async (auth) => {
      const found = await searchEntries(auth, NO_CRITERIA);
      return isOk(found) ? found.value : [];
    },
  };
}

function posted(result: Result<Entry, DomainError>): Entry {
  expect(isOk(result), 'test setup posted an entry that breaks a rule').toBe(true);
  return isOk(result) ? result.value : ({} as Entry);
}

const DOWN = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

function withRequestKeys(
  books: InMemoryEntries,
  replaced: Partial<RequestKeyRepository>,
): UnitOfWork {
  return {
    run: (work) =>
      books.unitOfWork.run((entries, requestKeys) => work(entries, { ...requestKeys, ...replaced })),
  };
}

describe('createPostEntry with a Request key', () => {
  it('posts the Entry and records the key against it, with the Connection that posted it', async () => {
    const { books, postEntry, visible } = keyedUseCases();

    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));

    expect(await visible(ADA)).toEqual([first]);
    expect(books.keys).toEqual([
      { userId: ADA_ID, requestKey: KEY, entryId: first.id, connectionId: PHONE },
    ]);
  });

  it('records no Connection for a key sent by a User signed in without one', async () => {
    const { books, postEntry } = keyedUseCases();

    const first = posted(await postEntry(ADA, draft(12500, 12500), KEY));

    expect(books.keys).toEqual([
      { userId: ADA_ID, requestKey: KEY, entryId: first.id, connectionId: undefined },
    ]);
  });

  it('answers a repeated post with the Entry the first one posted, and posts nothing more', async () => {
    const { books, postEntry, visible } = keyedUseCases();
    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));

    const again = await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY);

    expect(again).toEqual(ok(first));
    expect(await visible(ADA)).toEqual([first]);
    expect(books.keys).toHaveLength(1);
  });

  it('refuses as a conflict a key already used for other content, and posts nothing more', async () => {
    const { postEntry, visible } = keyedUseCases();
    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));

    const again = await postEntry(ADA_ON_PHONE, draft(9900, 9900), KEY);

    expect(isErr(again) && again.error.code).toBe('CONFLICT');
    expect(await visible(ADA)).toEqual([first]);
  });

  it('refuses as a conflict a key whose Entry has since been deleted, and posts nothing', async () => {
    const { postEntry, deleteEntry, visible } = keyedUseCases();
    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));
    expect(await deleteEntry(ADA, first.id)).toEqual(ok(undefined));

    const again = await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY);

    expect(isErr(again) && again.error.code).toBe('CONFLICT');
    expect(await visible(ADA)).toEqual([]);
  });

  it('posts once for the same key sent through two of the User\'s Connections', async () => {
    const { books, postEntry, visible } = keyedUseCases();
    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));

    const again = await postEntry(ADA_ON_LAPTOP, draft(12500, 12500), KEY);

    expect(again).toEqual(ok(first));
    expect(await visible(ADA)).toEqual([first]);
    expect(books.keys.map((key) => key.connectionId)).toEqual([PHONE]);
  });

  it('posts for each User who sends the same key', async () => {
    const { postEntry, visible } = keyedUseCases();

    const adas = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));
    const graces = posted(await postEntry(GRACE_ON_PHONE, GRACES_DRAFT, KEY));

    expect(graces.id).not.toBe(adas.id);
    expect(await visible(ADA)).toEqual([adas]);
    expect(await visible(GRACE)).toEqual([graces]);
  });

  it('posts two Entries for two alike posts with different keys', async () => {
    const { postEntry, visible } = keyedUseCases();

    posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));
    posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), 'another key'));

    expect(await visible(ADA)).toHaveLength(2);
  });

  it('posts two Entries for two alike posts without a key, recording none', async () => {
    const { books, postEntry, visible } = keyedUseCases();

    posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500)));
    posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500)));

    expect(await visible(ADA)).toHaveLength(2);
    expect(books.keys).toEqual([]);
  });

  it('refuses a keyed post the Entry rules refuse, recording no key, so the key still posts', async () => {
    const { books, postEntry, visible } = keyedUseCases();

    const refused = await postEntry(ADA_ON_PHONE, draft(12500, 12000), KEY);

    expect(isErr(refused) && refused.error.code).toBe('UNBALANCED');
    expect(books.keys).toEqual([]);
    const first = posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));
    expect(await visible(ADA)).toEqual([first]);
  });

  it('answers the Entry another post recorded the key for while this one was posting, leaving one Entry', async () => {
    const books = inMemoryBooks();
    const { postEntry: postFirst } = keyedUseCases(books);
    const first = posted(await postFirst(ADA_ON_PHONE, draft(12500, 12500), KEY));
    let lookups = 0;
    const racing: UnitOfWork = {
      run: (work) =>
        books.unitOfWork.run((entries, requestKeys) => {
          lookups += 1;
          return work(entries, {
            ...requestKeys,
            find: lookups === 1 ? () => Promise.resolve(ok(undefined)) : requestKeys.find,
          });
        }),
    };
    const { postEntry, visible } = keyedUseCases(books, racing);

    const again = await postEntry(ADA_ON_LAPTOP, draft(12500, 12500), KEY);

    expect(again).toEqual(ok(first));
    expect(await visible(ADA)).toEqual([first]);
    expect(books.keys).toHaveLength(1);
  });

  it('posts nothing when the key cannot be recorded, and reports why', async () => {
    const books = inMemoryBooks();
    const failing = withRequestKeys(books, { record: () => Promise.resolve(err(DOWN)) });
    const { postEntry, visible } = keyedUseCases(books, failing);

    expect(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY)).toEqual(err(DOWN));
    expect(await visible(ADA)).toEqual([]);
  });

  it('posts nothing when the key cannot be looked up, and reports why', async () => {
    const books = inMemoryBooks();
    const failing = withRequestKeys(books, { find: () => Promise.resolve(err(DOWN)) });
    const { postEntry, visible } = keyedUseCases(books, failing);

    expect(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY)).toEqual(err(DOWN));
    expect(await visible(ADA)).toEqual([]);
    expect(books.keys).toEqual([]);
  });

  it('reports a failure to read the Entry its key posted', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const books = inMemoryBooks({ find: () => Promise.resolve(err(down)) });
    const { postEntry } = keyedUseCases(books);
    posted(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY));

    expect(await postEntry(ADA_ON_PHONE, draft(12500, 12500), KEY)).toEqual(err(down));
  });

  it('refuses a keyed post for nobody, as unauthenticated, recording nothing', async () => {
    const { books, postEntry } = keyedUseCases();

    const refused = await postEntry(SIGNED_OUT, draft(12500, 12500), KEY);

    expect(isErr(refused) && refused.error.code).toBe('UNAUTHENTICATED');
    expect(books.rows).toEqual([]);
    expect(books.keys).toEqual([]);
  });
});
