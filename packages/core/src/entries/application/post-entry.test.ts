import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type AccountId,
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
};

const ENTRY_ID = '01920000-0000-7000-8000-000000000001' as EntryId;
const CREATED_AT = new Date('2026-09-15T00:30:00.000Z');

const draft = (debit: number, credit: number): EntryDraft => ({
  entryDate: '2026-09-15',
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
      newEntryId: () => ENTRY_ID,
      now: () => CREATED_AT,
    }),
    searchEntries: createSearchEntries({ entries, accounts }),
  };
}

describe('createPostEntry', () => {
  it('stores a balanced entry, stamped with the injected id and clock, where it is found', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(posted.value.id).toBe(ENTRY_ID);
    expect(posted.value.createdAt).toEqual(CREATED_AT);
    expect(posted.value.total).toBe(12500);
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
