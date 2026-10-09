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
import { accountNames, type Account } from '../../accounts/domain/account';
import { SIGNED_OUT } from '../../auth/domain/auth-context';
import { makeEntry, MEMO_MAX_LENGTH, type Entry } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';
import { createSearchEntries } from './search-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const PAYABLE = '01920000-0000-7000-8000-00000000c002' as AccountId;
const SALES = '01920000-0000-7000-8000-00000000c004' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const GRACES_CASH = '01920000-0000-7000-8000-00000000d001' as AccountId;

const account = (id: AccountId, accountType: Account['accountType'], name: string): Account => ({
  id,
  accountType,
  name,
  description: null,
  position: 0,
  activeFrom: '2026-01-01',
  activeUntil: null,
});

const ADAS_CHART = [
  account(CASH, 'asset', 'Cash'),
  account(PAYABLE, 'liability', 'Accounts payable'),
  account(SALES, 'revenue', 'Sales'),
  account(EXPENSES, 'expense', 'Expenses'),
];

const { accounts, hold } = inMemoryAccounts();
hold(ADA, ADAS_CHART);
hold(GRACE, [account(GRACES_CASH, 'asset', 'Cash')]);

const made = makeEntry(
  {
    entryDate: '2026-09-15',
    memo: 'Office supplies',
    lines: [
      { account: EXPENSES, side: 'debit', amount: 12500 as Money },
      { account: CASH, side: 'credit', amount: 12500 as Money },
    ],
  },
  {
    id: '01920000-0000-7000-8000-000000000001' as EntryId,
    createdAt: new Date('2026-09-15T00:30:00.000Z'),
  },
  accountNames(ADAS_CHART),
);

const holding = (searched: EntryRepository['search']): EntryRepository => ({
  save: () => Promise.resolve(ok(undefined)),
  saveReversal: () => Promise.resolve(ok(undefined)),
  find: () => Promise.resolve(err(domainError('NOT_FOUND', 'Not read here.'))),
  search: searched,
});

const holdingMatching = (held: readonly Entry[]): EntryRepository =>
  holding((_userId, criteria) =>
    Promise.resolve(
      ok(
        held.filter(
          (entry) =>
            (criteria.from === undefined || entry.entryDate >= criteria.from) &&
            (criteria.to === undefined || entry.entryDate <= criteria.to) &&
            (criteria.account === undefined ||
              entry.lines.some((line) => line.account === criteria.account)) &&
            (criteria.memo === undefined ||
              entry.memo.toLowerCase().includes(criteria.memo.toLowerCase())),
        ),
      ),
    ),
  );

describe('createSearchEntries', () => {
  it('answers with what the repository holds, in the order it holds it', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const later: Entry = { ...made.value, entryDate: '2026-09-16' };
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([later, made.value]))),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([later, made.value]);
  });

  it('passes a repository failure through as the result', async () => {
    const searchEntries = createSearchEntries({
      entries: holding(() =>
        Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
      ),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isErr(found)).toBe(true);
    if (!isErr(found)) return;
    expect(found.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('searches the books of the signed-in User, and nobody else', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const own = made.value;
    const searchEntries = createSearchEntries({
      entries: holding((userId) => Promise.resolve(ok(userId === ADA ? [own] : []))),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(found) && found.value).toEqual([own]);
  });

  it('searches with the criteria it was given, so a day range narrows the answer', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([october, september]),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, { from: '2026-10-01' });

    expect(isOk(found) && found.value).toEqual([october]);
  });

  it('searches with each end of a range on its own, and with neither', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([october, september]),
      accounts,
    });

    const upTo = await searchEntries({ userId: ADA }, { to: '2026-09-30' });
    const between = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', to: '2026-10-31' },
    );
    const everything = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(upTo) && upTo.value).toEqual([september]);
    expect(isOk(between) && between.value).toEqual([october]);
    expect(isOk(everything) && everything.value).toEqual([october, september]);
  });

  it('searches with the Account it was given, so it narrows the answer too', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const touchingCash = made.value;
    const onAccount: Entry = {
      ...touchingCash,
      lines: [
        { account: EXPENSES, accountName: 'Expenses', side: 'debit', amount: 12500 as Money },
        {
          account: PAYABLE,
          accountName: 'Accounts payable',
          side: 'credit',
          amount: 12500 as Money,
        },
      ],
    };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([onAccount, touchingCash]),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, { account: CASH });

    expect(isOk(found) && found.value).toEqual([touchingCash]);
  });

  it('narrows by the Account and the range together, with `and`', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([october, september]),
      accounts,
    });

    const both = await searchEntries({ userId: ADA }, { from: '2026-10-01', account: CASH });
    const otherAccount = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', account: SALES },
    );

    expect(isOk(both) && both.value).toEqual([october]);
    expect(isOk(otherAccount) && otherAccount.value).toEqual([]);
  });

  it("refuses another User's Account, which is outside the chart of accounts, and searches nothing", async () => {
    const searched: UserId[] = [];
    const searchEntries = createSearchEntries({
      entries: holding((userId) => {
        searched.push(userId);
        return Promise.resolve(ok([]));
      }),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, { account: GRACES_CASH });

    expect(isErr(found) && found.error.code).toBe('INVALID_INPUT');
    expect(searched).toEqual([]);
  });

  it('passes a failure to read the chart of accounts through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([]))),
      accounts: { readChart: () => Promise.resolve(err(down)) },
    });

    expect(await searchEntries({ userId: ADA }, NO_CRITERIA)).toEqual(err(down));
  });

  it('refuses a range that ends before it starts, and searches nothing', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const searchEntries = createSearchEntries({ entries: holdingMatching([made.value]), accounts });

    const found = await searchEntries(
      { userId: ADA },
      { from: '2026-09-30', to: '2026-09-01' },
    );

    expect(isErr(found)).toBe(true);
    expect(isErr(found) && found.error.code).toBe('INVALID_INPUT');
  });

  it('searches with the memo term it was given, so it narrows the answer too', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const supplies = made.value;
    const rent: Entry = { ...supplies, memo: 'Office rent' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([rent, supplies]),
      accounts,
    });

    const found = await searchEntries({ userId: ADA }, { memo: 'supplies' });

    expect(isOk(found) && found.value).toEqual([supplies]);
  });

  it('searches with the term trimmed, and with a whitespace term not at all', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const supplies = made.value;
    const rent: Entry = { ...supplies, memo: 'Office rent' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([rent, supplies]),
      accounts,
    });

    const trimmed = await searchEntries({ userId: ADA }, { memo: '  supplies  ' });
    const blank = await searchEntries({ userId: ADA }, { memo: '   ' });

    expect(isOk(trimmed) && trimmed.value).toEqual([supplies]);
    expect(isOk(blank) && blank.value).toEqual([rent, supplies]);
  });

  it('narrows by the memo, the Account and the range together, with `and`', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04', memo: 'Office rent' };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([october, september]),
      accounts,
    });

    const all = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', account: CASH, memo: 'rent' },
    );
    const wrongMemo = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', account: CASH, memo: 'supplies' },
    );

    expect(isOk(all) && all.value).toEqual([october]);
    expect(isOk(wrongMemo) && wrongMemo.value).toEqual([]);
  });

  it('refuses a memo term longer than a memo can be, and searches nothing', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const searchEntries = createSearchEntries({ entries: holdingMatching([made.value]), accounts });

    const found = await searchEntries({ userId: ADA }, { memo: 'a'.repeat(MEMO_MAX_LENGTH + 1) });

    expect(isErr(found)).toBe(true);
    expect(isErr(found) && found.error.code).toBe('INVALID_INPUT');
  });

  it('refuses to search for nobody, as unauthenticated', async () => {
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([]))),
      accounts,
    });

    const found = await searchEntries(SIGNED_OUT, NO_CRITERIA);

    expect(isErr(found) && found.error.code).toBe('UNAUTHENTICATED');
  });
});
