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
import { createGetIncomeStatement } from './get-income-statement';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

const JUNE = { from: '2026-06-01', to: '2026-06-30' };

const account = (n: number, accountType: Account['accountType'], name: string): Account => ({
  id: `01920000-0000-7000-8000-00000000c00${String(n)}` as AccountId,
  accountType,
  groupId: null,
  name,
  description: null,
  position: n,
  activeFrom: '2026-01-01',
  activeUntil: null,
});

const CASH = account(1, 'asset', 'Cash');
const SALES = account(4, 'revenue', 'Sales');
const EXPENSES = account(5, 'expense', 'Expenses');
const CHART = [CASH, SALES, EXPENSES];

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
  statement: Awaited<ReturnType<ReturnType<typeof createGetIncomeStatement>>>,
) =>
  statement.ok
    ? {
        revenue: statement.value.revenue.total,
        expense: statement.value.expense.total,
        netIncome: statement.value.netIncome,
      }
    : statement.error.code;

describe('createGetIncomeStatement', () => {
  it("builds the User's statement from the shown Entries dated in the range, both ends included", async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-05-31', EXPENSES, CASH, 1),
      entry('2026-06-01', EXPENSES, CASH, 20),
      entry('2026-06-30', CASH, SALES, 300),
      entry('2026-07-01', CASH, SALES, 4000),
    ]);
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    const statement = await getIncomeStatement({ userId: ADA }, JUNE);

    expect(statement.ok && statement.value).toEqual({
      revenue: { total: 300, rows: [{ kind: 'account', account: SALES.id, name: 'Sales', total: 300 }] },
      expense: {
        total: 20,
        rows: [{ kind: 'account', account: EXPENSES.id, name: 'Expenses', total: 20 }],
      },
      netIncome: 280,
    });
  });

  it('leaves out a deleted Entry and its Reversal', async () => {
    const deleted = entry('2026-06-15', EXPENSES, CASH, 500);
    const { accounts, stored } = await booksOf(ADA, [deleted, entry('2026-06-15', EXPENSES, CASH, 70)]);
    await stored.entries.saveReversal(
      ADA,
      makeReversal(deleted, {
        id: '01920000-0000-7000-8000-0000000000ff' as EntryId,
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
      }),
    );
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    expect(totalsOf(await getIncomeStatement({ userId: ADA }, JUNE))).toEqual({
      revenue: 0,
      expense: 70,
      netIncome: -70,
    });
  });

  it("counts no other User's Entries", async () => {
    const { accounts, stored } = await booksOf(ADA, [entry('2026-06-15', EXPENSES, CASH, 500)]);
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    const graces = await getIncomeStatement({ userId: GRACE }, JUNE);

    expect(totalsOf(graces)).toEqual({ revenue: 0, expense: 0, netIncome: 0 });
    expect(graces.ok && graces.value.expense.rows.map(({ name }) => name)).toEqual(['Expenses']);
  });

  it('refuses to build a statement for nobody, as unauthenticated', async () => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    expect(totalsOf(await getIncomeStatement(SIGNED_OUT, JUNE))).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['a range that ends before it starts', { from: '2026-06-30', to: '2026-06-01' }],
    ['a From that is no calendar day', { from: '2026-02-30', to: '2026-03-31' }],
    ['a To that is not a day at all', { from: '2026-06-01', to: 'June' }],
  ])('refuses %s as invalid input', async (_case, range) => {
    const { accounts, stored } = await booksOf(ADA, []);
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    expect(totalsOf(await getIncomeStatement({ userId: ADA }, range))).toBe('INVALID_INPUT');
  });

  it('passes a failure to read the chart of accounts through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getIncomeStatement = createGetIncomeStatement({
      entries: stored.entries,
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await getIncomeStatement({ userId: ADA }, JUNE)).toEqual(err(down));
  });

  it('passes a failure to read the Account totals through as the result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, stored } = await booksOf(ADA, []);
    const getIncomeStatement = createGetIncomeStatement({
      entries: { ...stored.entries, accountTotals: () => Promise.resolve(err(down)) },
      accounts,
    });

    expect(await getIncomeStatement({ userId: ADA }, JUNE)).toEqual(err(down));
  });

  it('refuses totals beyond what an amount can hold', async () => {
    const { accounts, stored } = await booksOf(ADA, [
      entry('2026-06-15', EXPENSES, CASH, Number.MAX_SAFE_INTEGER),
      entry('2026-06-16', EXPENSES, CASH, Number.MAX_SAFE_INTEGER),
    ]);
    const getIncomeStatement = createGetIncomeStatement({ entries: stored.entries, accounts });

    expect(totalsOf(await getIncomeStatement({ userId: ADA }, JUNE))).toBe('INVALID_INPUT');
  });
});
