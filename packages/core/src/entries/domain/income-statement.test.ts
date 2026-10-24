import { describe, expect, it } from 'vitest';
import {
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type Money,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../../accounts/domain/account';
import { incomeStatement, type AccountSums, type IncomeStatement } from './income-statement';

const JUNE = { from: '2026-06-01', to: '2026-06-30' };

const id = (n: number): AccountId => `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId;

const account = (
  n: number,
  accountType: AccountType,
  name: string,
  overrides: Partial<Account> = {},
): Account => ({
  id: id(n),
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
const SALES = account(4, 'revenue', 'Sales');
const EXPENSES = account(5, 'expense', 'Expenses');

const STARTING: Chart = { accounts: [CASH, PAYABLE, CAPITAL, SALES, EXPENSES], groups: [] };

const sums = (of: Account, debit: number, credit: number): AccountSums => ({
  account: of.id,
  debit: debit as Money,
  credit: credit as Money,
});

const statementOf = (
  chart: Chart,
  named: readonly AccountSums[],
  range = JUNE,
): IncomeStatement | undefined => {
  const built = incomeStatement(chart, range, named);
  expect(built.ok, 'the statement was built').toBe(true);
  return built.ok ? built.value : undefined;
};

const row = (of: Account, total: number) => ({
  kind: 'account',
  account: of.id,
  name: of.name,
  total,
});

const namesIn = (built: IncomeStatement | undefined) => ({
  revenue: built?.revenue.rows.map(({ name }) => name),
  expense: built?.expense.rows.map(({ name }) => name),
});

describe('incomeStatement', () => {
  it('totals a revenue Account as its credits less its debits', () => {
    const built = statementOf(STARTING, [sums(SALES, 3000, 12500)]);

    expect(built?.revenue).toEqual({ total: 9500, rows: [row(SALES, 9500)] });
  });

  it('totals an expense Account as its debits less its credits', () => {
    const built = statementOf(STARTING, [sums(EXPENSES, 4000, 1000)]);

    expect(built?.expense).toEqual({ total: 3000, rows: [row(EXPENSES, 3000)] });
  });

  it('shows a total that comes out below zero as negative, never clamped', () => {
    const built = statementOf(STARTING, [sums(SALES, 2000, 500), sums(EXPENSES, 0, 5000)]);

    expect(built?.revenue.total).toBe(-1500);
    expect(built?.expense.total).toBe(-5000);
    expect(built?.difference).toBe(3500);
  });

  it('totals each section over its Accounts and takes the difference as revenue less expense', () => {
    const travel = account(6, 'expense', 'Travel');
    const built = statementOf({ ...STARTING, accounts: [...STARTING.accounts, travel] }, [
      sums(SALES, 0, 10000),
      sums(EXPENSES, 4000, 0),
      sums(travel, 2500, 0),
    ]);

    expect(built).toEqual({
      revenue: { total: 10000, rows: [row(SALES, 10000)] },
      expense: { total: 6500, rows: [row(EXPENSES, 4000), row(travel, 2500)] },
      difference: 3500,
    });
  });

  it('lists every revenue and expense Account active in the range at zero, with both sections at zero, when nothing is summed', () => {
    expect(statementOf(STARTING, [])).toEqual({
      revenue: { total: 0, rows: [row(SALES, 0)] },
      expense: { total: 0, rows: [row(EXPENSES, 0)] },
      difference: 0,
    });
  });

  it('shows both sections, empty and at zero, for a chart with no revenue or expense Account', () => {
    expect(statementOf({ accounts: [CASH], groups: [] }, [])).toEqual({
      revenue: { total: 0, rows: [] },
      expense: { total: 0, rows: [] },
      difference: 0,
    });
  });

  it('leaves out asset, liability and equity Accounts, even when the sums name them', () => {
    const built = statementOf(STARTING, [
      sums(CASH, 100, 0),
      sums(PAYABLE, 0, 100),
      sums(CAPITAL, 0, 100),
    ]);

    expect(namesIn(built)).toEqual({ revenue: ['Sales'], expense: ['Expenses'] });
    expect(built?.difference).toBe(0);
  });

  it('lists an Account whose Active period overlaps the range by even one day at either end', () => {
    const endsOnTheFirst = account(6, 'expense', 'Ends on the first', { activeUntil: '2026-06-01' });
    const startsOnTheLast = account(7, 'revenue', 'Starts on the last', {
      activeFrom: '2026-06-30',
    });
    const built = statementOf(
      { ...STARTING, accounts: [...STARTING.accounts, endsOnTheFirst, startsOnTheLast] },
      [],
    );

    expect(namesIn(built)).toEqual({
      revenue: ['Sales', 'Starts on the last'],
      expense: ['Expenses', 'Ends on the first'],
    });
  });

  it('leaves out an Account active only before or only after the range when no sum names it', () => {
    const endedBefore = account(6, 'expense', 'Ended before', { activeUntil: '2026-05-31' });
    const startsAfter = account(7, 'revenue', 'Starts after', { activeFrom: '2026-07-01' });
    const built = statementOf(
      { ...STARTING, accounts: [...STARTING.accounts, endedBefore, startsAfter] },
      [],
    );

    expect(namesIn(built)).toEqual({ revenue: ['Sales'], expense: ['Expenses'] });
  });

  it('lists an Account the sums name even when its Active period no longer covers the range', () => {
    const endedBefore = account(6, 'expense', 'Ended before', { activeUntil: '2026-05-31' });
    const startsAfter = account(7, 'revenue', 'Starts after', { activeFrom: '2026-07-01' });
    const built = statementOf(
      { ...STARTING, accounts: [...STARTING.accounts, endedBefore, startsAfter] },
      [sums(endedBefore, 700, 0), sums(startsAfter, 0, 300)],
    );

    expect(built).toEqual({
      revenue: { total: 300, rows: [row(SALES, 0), row(startsAfter, 300)] },
      expense: { total: 700, rows: [row(EXPENSES, 0), row(endedBefore, 700)] },
      difference: -400,
    });
  });

  it('lists the Accounts in Chart of accounts order, the Accounts of a group at the group\'s place', () => {
    const food = {
      id: '01920000-0000-7000-8000-0000000000f1' as AccountGroupId,
      accountType: 'expense',
      name: 'Food',
      description: null,
      position: 1,
    } satisfies AccountGroup;
    const rent = account(6, 'expense', 'Rent', { position: 2 });
    const groceries = account(7, 'expense', 'Groceries', { groupId: food.id, position: 1 });
    const dining = account(8, 'expense', 'Dining', { groupId: food.id, position: 0 });
    const expenses = { ...EXPENSES, position: 0 };
    const built = statementOf(
      {
        accounts: [CASH, SALES, rent, groceries, dining, expenses],
        groups: [food],
      },
      [],
    );

    expect(namesIn(built).expense).toEqual(['Expenses', 'Dining', 'Groceries', 'Rent']);
  });

  it('refuses sums whose totals come out beyond what an amount can hold', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const other = account(6, 'revenue', 'Other sales');
    const twoAccounts = { ...STARTING, accounts: [...STARTING.accounts, other] };

    for (const [chart, named] of [
      [STARTING, [sums(SALES, -1, big)]],
      [STARTING, [sums(EXPENSES, big, -1)]],
      [twoAccounts, [sums(SALES, 0, big), sums(other, 0, big)]],
      [STARTING, [sums(SALES, 0, big), sums(EXPENSES, 0, big)]],
    ] as const) {
      const built = incomeStatement(chart, JUNE, named);

      expect(!built.ok && built.error.code).toBe('INVALID_INPUT');
    }
  });
});
