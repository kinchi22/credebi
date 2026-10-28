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
import { accountNames, type Account } from '../../accounts/domain/account';
import { SIGNED_OUT } from '../../auth/domain/auth-context';
import { makeEntry, type Entry } from '../domain/entry';
import { makeReversal } from '../domain/reversal';
import { createGetAssetsAndLiabilitiesTrend } from './get-assets-and-liabilities-trend';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

const account = (
  n: number,
  accountType: Account['accountType'],
  name: string,
  overrides: Partial<Account> = {},
): Account => ({
  id: `01920000-0000-7000-8000-00000000c00${String(n)}` as AccountId,
  accountType,
  groupId: null,
  name,
  description: null,
  position: n,
  activeFrom: '2001-01-01',
  activeUntil: null,
  ...overrides,
});

const CASH = account(1, 'asset', 'Cash');
const PAYABLE = account(2, 'liability', 'Accounts payable');
const CAPITAL = account(3, 'equity', 'Capital');
const EXPENSES = account(5, 'expense', 'Expenses');
const OLD_LOAN = account(6, 'liability', 'Old loan', { activeUntil: '2026-06-15' });
const CHART = [CASH, PAYABLE, CAPITAL, EXPENSES, OLD_LOAN];

const JUNE_TO_AUGUST = { from: '2026-06', to: '2026-08' };

let sequence = 0;

function entry(entryDate: string, debit: Account, credit: Account, amount: number): Entry {
  sequence += 1;
  const made = makeEntry(
    {
      entryDate,
      title: '',
      memo: '',
      lines: [
        { account: debit.id, side: 'debit', amount: amount as Money },
        { account: credit.id, side: 'credit', amount: amount as Money },
      ],
    },
    {
      id: `01920000-0000-7000-8000-${String(sequence).padStart(12, '0')}` as EntryId,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    },
    accountNames(CHART),
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

async function booksOf(userId: UserId, written: readonly Entry[]) {
  const held = inMemoryAccounts();
  held.hold(ADA, CHART);
  held.hold(GRACE, CHART);
  const stored = inMemoryEntries();
  for (const one of written) {
    await stored.entries.save(userId, one);
  }
  return { accounts: held.accounts, stored };
}

type Answer = Awaited<ReturnType<ReturnType<typeof createGetAssetsAndLiabilitiesTrend>>>;

const rowsOf = (answer: Answer) =>
  answer.ok
    ? answer.value.months.map(({ month, totalAssets, totalLiabilities, netWorth }) => [
        month,
        totalAssets,
        totalLiabilities,
        netWorth,
      ])
    : answer.error.code;

describe('createGetAssetsAndLiabilitiesTrend', () => {
  it("answers each month of the range with the User's shown Entries accumulated through its last day", async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2001-01-01', CASH, CAPITAL, 1),
      entry('2026-06-30', CASH, CAPITAL, 10000),
      entry('2026-07-01', EXPENSES, CASH, 3000),
      entry('2026-07-31', EXPENSES, PAYABLE, 400),
      entry('2026-09-01', CASH, CAPITAL, 50000),
    ]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    const trend = await getTrend({ userId: ADA }, JUNE_TO_AUGUST);

    expect(rowsOf(trend)).toEqual([
      ['2026-06', 10001, 0, 10001],
      ['2026-07', 7001, 400, 6601],
      ['2026-08', 7001, 400, 6601],
    ]);
    expect(trend.ok && trend.value.recorded).toBe(true);
  });

  it('counts an Account in the month its Active period ends, and not from the month after', async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-10', EXPENSES, OLD_LOAN, 3000)]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend({ userId: ADA }, JUNE_TO_AUGUST))).toEqual([
      ['2026-06', 0, 3000, -3000],
      ['2026-07', 0, 0, 0],
      ['2026-08', 0, 0, 0],
    ]);
  });

  it('leaves out a deleted Entry and the Entry a Correction replaced, and counts the replacement', async () => {
    const deleted = entry('2026-06-15', EXPENSES, CASH, 500);
    const corrected = entry('2026-06-15', EXPENSES, CASH, 4000);
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-06-10', CASH, CAPITAL, 10000),
      deleted,
      corrected,
    ]);
    for (const [reversed, n] of [
      [deleted, 'ff'],
      [corrected, 'fe'],
    ] as const) {
      await stored.entries.saveReversal(
        ADA,
        makeReversal(reversed, {
          id: `01920000-0000-7000-8000-0000000000${n}` as EntryId,
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
        }),
      );
    }
    await stored.entries.save(ADA, entry('2026-06-15', EXPENSES, CASH, 3000));
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend({ userId: ADA }, { from: '2026-06', to: '2026-06' }))).toEqual([
      ['2026-06', 7000, 0, 7000],
    ]);
  });

  it("counts no other User's Entries, and says nothing is recorded for a User with none", async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-15', CASH, CAPITAL, 500)]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    const graces = await getTrend({ userId: GRACE }, JUNE_TO_AUGUST);

    expect(rowsOf(graces)).toEqual([
      ['2026-06', 0, 0, 0],
      ['2026-07', 0, 0, 0],
      ['2026-08', 0, 0, 0],
    ]);
    expect(graces.ok && graces.value.recorded).toBe(false);
  });

  it('says nothing is recorded when every shown Entry is dated after the last month, and that something is once one predates the range', async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-09-01', CASH, CAPITAL, 500)]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    const later = await getTrend({ userId: ADA }, JUNE_TO_AUGUST);
    expect(later.ok && later.value.recorded).toBe(false);

    await stored.entries.save(ADA, entry('2026-01-15', EXPENSES, CAPITAL, 1));
    const earlier = await getTrend({ userId: ADA }, JUNE_TO_AUGUST);
    expect(earlier.ok && earlier.value.recorded).toBe(true);
  });

  it('refuses to answer for nobody, as unauthenticated', async () => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend(SIGNED_OUT, JUNE_TO_AUGUST))).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['reversed', { from: '2026-08', to: '2026-06' }],
    ['longer than 600 months', { from: '1980-01', to: '2030-01' }],
    ['made of something other than calendar months', { from: '2026-06-01', to: '2026-08' }],
  ])('refuses a range %s as invalid input', async (_case, range) => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend({ userId: ADA }, range))).toBe('INVALID_INPUT');
  });

  it('passes a failure to read the chart of accounts through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getTrend = createGetAssetsAndLiabilitiesTrend({
      entries: stored.entries,
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await getTrend({ userId: ADA }, JUNE_TO_AUGUST)).toEqual(err(down));
  });

  it('passes a failure to read the monthly Account totals through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getTrend = createGetAssetsAndLiabilitiesTrend({
      entries: { ...stored.entries, monthlyAccountTotals: () => Promise.resolve(err(down)) },
      accounts,
    });

    expect(await getTrend({ userId: ADA }, JUNE_TO_AUGUST)).toEqual(err(down));
  });

  it('refuses balances beyond what an amount can hold, the opening amount and a month together', async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-05-15', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
      entry('2026-06-16', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
    ]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend({ userId: ADA }, JUNE_TO_AUGUST))).toBe('INVALID_INPUT');
  });

  it('refuses balances beyond what an amount can hold within the opening amount itself', async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-04-15', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
      entry('2026-05-16', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
    ]);
    const getTrend = createGetAssetsAndLiabilitiesTrend({ entries: stored.entries, accounts });

    expect(rowsOf(await getTrend({ userId: ADA }, JUNE_TO_AUGUST))).toBe('INVALID_INPUT');
  });
});
