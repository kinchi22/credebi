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
import { createGetAssetsAndLiabilities } from './get-assets-and-liabilities';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

const JUNE_LAST = '2026-06-30';

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
  activeFrom: '2026-01-01',
  activeUntil: null,
  ...overrides,
});

const CASH = account(1, 'asset', 'Cash');
const PAYABLE = account(2, 'liability', 'Accounts payable');
const CAPITAL = account(3, 'equity', 'Capital');
const EXPENSES = account(5, 'expense', 'Expenses');
const OLD_LOAN = account(6, 'liability', 'Old loan', { activeUntil: JUNE_LAST });
const CHART = [CASH, PAYABLE, CAPITAL, EXPENSES, OLD_LOAN];

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

const totalsOf = (
  report: Awaited<ReturnType<ReturnType<typeof createGetAssetsAndLiabilities>>>,
) =>
  report.ok
    ? {
        assets: report.value.assets.total,
        liabilities: report.value.liabilities.total,
        netWorth: report.value.netWorth,
      }
    : report.error.code;

describe('createGetAssetsAndLiabilities', () => {
  it("accumulates the User's shown Entries from the start of the books through the day, that day included", async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2001-01-01', CASH, CAPITAL, 1),
      entry('2026-06-10', CASH, CAPITAL, 10000),
      entry('2026-06-20', EXPENSES, CASH, 3000),
      entry(JUNE_LAST, EXPENSES, PAYABLE, 400),
      entry('2026-07-01', CASH, CAPITAL, 50000),
    ]);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    const report = await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST);

    expect(report.ok && report.value).toEqual({
      assets: { total: 7001, rows: [{ kind: 'account', account: CASH.id, name: 'Cash', total: 7001 }] },
      liabilities: {
        total: 400,
        rows: [
          { kind: 'account', account: PAYABLE.id, name: 'Accounts payable', total: 400 },
          { kind: 'account', account: OLD_LOAN.id, name: 'Old loan', total: 0 },
        ],
      },
      netWorth: 6601,
    });
  });

  it('leaves an Account with a balance out of every total the day after its Active period ends', async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-15', EXPENSES, OLD_LOAN, 3000)]);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST))).toEqual({
      assets: 0,
      liabilities: 3000,
      netWorth: -3000,
    });
    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, '2026-07-01'))).toEqual({
      assets: 0,
      liabilities: 0,
      netWorth: 0,
    });
  });

  it('leaves out a deleted Entry and its Reversal', async () => {
    const deleted = entry('2026-06-15', EXPENSES, CASH, 500);
    const { accounts, stored } = await booksOf(ADA, [deleted, entry('2026-06-15', CASH, CAPITAL, 70)]);
    await stored.entries.saveReversal(
      ADA,
      makeReversal(deleted, {
        id: '01920000-0000-7000-8000-0000000000ff' as EntryId,
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
      }),
    );
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST))).toEqual({
      assets: 70,
      liabilities: 0,
      netWorth: 70,
    });
  });

  it('leaves out the Entry a Correction replaced and counts its replacement', async () => {
    const corrected = entry('2026-06-15', EXPENSES, CASH, 4000);
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-10', CASH, CAPITAL, 10000), corrected]);
    await stored.entries.saveReversal(
      ADA,
      makeReversal(corrected, {
        id: '01920000-0000-7000-8000-0000000000fe' as EntryId,
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
      }),
    );
    await stored.entries.save(ADA, entry('2026-06-15', EXPENSES, CASH, 3000));
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST))).toEqual({
      assets: 7000,
      liabilities: 0,
      netWorth: 7000,
    });
  });

  it("counts no other User's Entries", async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-15', CASH, CAPITAL, 500)]);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    const graces = await getAssetsAndLiabilities({ userId: GRACE }, JUNE_LAST);

    expect(totalsOf(graces)).toEqual({ assets: 0, liabilities: 0, netWorth: 0 });
    expect(graces.ok && graces.value.assets.rows.map(({ name }) => name)).toEqual(['Cash']);
  });

  it('refuses to build a report for nobody, as unauthenticated', async () => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities(SIGNED_OUT, JUNE_LAST))).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['no calendar day', '2026-02-30'],
    ['not a day at all', 'June'],
    ['empty', ''],
  ])('refuses a day that is %s as invalid input', async (_case, day) => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, day))).toBe('INVALID_INPUT');
  });

  it('passes a failure to read the chart of accounts through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({
      entries: stored.entries,
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST)).toEqual(err(down));
  });

  it('passes a failure to read the Account totals through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({
      entries: { ...stored.entries, accountTotals: () => Promise.resolve(err(down)) },
      accounts,
    });

    expect(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST)).toEqual(err(down));
  });

  it('refuses balances beyond what an amount can hold', async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-06-15', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
      entry('2026-06-16', CASH, CAPITAL, Number.MAX_SAFE_INTEGER),
    ]);
    const getAssetsAndLiabilities = createGetAssetsAndLiabilities({ entries: stored.entries, accounts });

    expect(totalsOf(await getAssetsAndLiabilities({ userId: ADA }, JUNE_LAST))).toBe('INVALID_INPUT');
  });
});
