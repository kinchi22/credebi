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

const group = (
  n: number,
  accountType: AccountType,
  name: string,
  position: number,
): AccountGroup => ({
  id: `01920000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}` as AccountGroupId,
  accountType,
  name,
  description: null,
  position,
});

const FOOD = group(1, 'expense', 'Food', 9);

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

const outline = (rows: IncomeStatement['revenue']['rows'] | undefined) =>
  rows?.flatMap((listed) =>
    listed.kind === 'group' ? [listed.name, listed.accounts.map(({ name }) => name)] : [listed.name],
  );

const rowsIn = (built: IncomeStatement | undefined) => ({
  revenue: outline(built?.revenue.rows),
  expense: outline(built?.expense.rows),
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
    expect(built?.netIncome).toBe(3500);
  });

  it('totals each section over its Accounts and takes the net income as revenue less expense', () => {
    const travel = account(6, 'expense', 'Travel');
    const built = statementOf({ ...STARTING, accounts: [...STARTING.accounts, travel] }, [
      sums(SALES, 0, 10000),
      sums(EXPENSES, 4000, 0),
      sums(travel, 2500, 0),
    ]);

    expect(built).toEqual({
      revenue: { total: 10000, rows: [row(SALES, 10000)] },
      expense: { total: 6500, rows: [row(EXPENSES, 4000), row(travel, 2500)] },
      netIncome: 3500,
    });
  });

  it('lists every revenue and expense Account active in the range at zero, with both sections at zero, when nothing is summed', () => {
    expect(statementOf(STARTING, [])).toEqual({
      revenue: { total: 0, rows: [row(SALES, 0)] },
      expense: { total: 0, rows: [row(EXPENSES, 0)] },
      netIncome: 0,
    });
  });

  it('shows both sections, empty and at zero, for a chart with no revenue or expense Account', () => {
    expect(statementOf({ accounts: [CASH], groups: [] }, [])).toEqual({
      revenue: { total: 0, rows: [] },
      expense: { total: 0, rows: [] },
      netIncome: 0,
    });
  });

  it('leaves out asset, liability and equity Accounts, even when the sums name them', () => {
    const built = statementOf(STARTING, [
      sums(CASH, 100, 0),
      sums(PAYABLE, 0, 100),
      sums(CAPITAL, 0, 100),
    ]);

    expect(namesIn(built)).toEqual({ revenue: ['Sales'], expense: ['Expenses'] });
    expect(built?.netIncome).toBe(0);
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
      netIncome: -400,
    });
  });

  it('puts each Account of a group under it, in the group\'s order, with the group\'s subtotal', () => {
    const groceries = account(6, 'expense', 'Groceries', { groupId: FOOD.id, position: 1 });
    const dining = account(7, 'expense', 'Dining', { groupId: FOOD.id, position: 0 });
    const built = statementOf(
      { accounts: [...STARTING.accounts, groceries, dining], groups: [FOOD] },
      [sums(EXPENSES, 1000, 0), sums(groceries, 2500, 500), sums(dining, 3000, 0)],
    );

    expect(built?.expense).toEqual({
      total: 6000,
      rows: [
        row(EXPENSES, 1000),
        {
          kind: 'group',
          group: FOOD.id,
          name: 'Food',
          total: 5000,
          accounts: [row(dining, 3000), row(groceries, 2000)],
        },
      ],
    });
    expect(built?.netIncome).toBe(-6000);
  });

  it('subtotals a group whose Accounts come out at zero or below zero', () => {
    const refunds = account(6, 'expense', 'Refunds', { groupId: FOOD.id });
    const idle = account(7, 'expense', 'Idle', { groupId: FOOD.id });
    const built = statementOf(
      { accounts: [...STARTING.accounts, refunds, idle], groups: [FOOD] },
      [sums(refunds, 0, 800)],
    );

    expect(built?.expense.rows[1]).toMatchObject({ kind: 'group', total: -800 });
    expect(built?.expense.total).toBe(-800);
  });

  it('keeps Chart of accounts order across groups and Accounts directly under their Account type', () => {
    const transport = group(2, 'expense', 'Transport', 3);
    const salary = group(3, 'revenue', 'Salary', 0);
    const rent = account(6, 'expense', 'Rent', { position: 2 });
    const groceries = account(7, 'expense', 'Groceries', { groupId: FOOD.id, position: 0 });
    const bus = account(8, 'expense', 'Bus', { groupId: transport.id, position: 0 });
    const basePay = account(9, 'revenue', 'Base pay', { groupId: salary.id, position: 0 });
    const built = statementOf(
      {
        accounts: [CASH, { ...SALES, position: 1 }, basePay, rent, bus, groceries, { ...EXPENSES, position: 0 }],
        groups: [transport, salary, { ...FOOD, position: 1 }],
      },
      [],
    );

    expect(rowsIn(built)).toEqual({
      revenue: ['Salary', ['Base pay'], 'Sales'],
      expense: ['Expenses', 'Food', ['Groceries'], 'Rent', 'Transport', ['Bus']],
    });
  });

  it('leaves out a group with no Account, and one whose every Account is out of the range', () => {
    const empty = group(2, 'expense', 'Empty', 8);
    const retired = group(3, 'expense', 'Retired', 9);
    const oldClub = account(6, 'expense', 'Old club', {
      groupId: retired.id,
      activeUntil: '2026-05-31',
    });
    const built = statementOf(
      { accounts: [...STARTING.accounts, oldClub], groups: [empty, retired] },
      [],
    );

    expect(rowsIn(built).expense).toEqual(['Expenses']);
  });

  it('lists a group whose only Account is out of the range when the sums name that Account', () => {
    const retired = group(2, 'expense', 'Retired', 9);
    const oldClub = account(6, 'expense', 'Old club', {
      groupId: retired.id,
      activeUntil: '2026-05-31',
    });
    const built = statementOf(
      { accounts: [...STARTING.accounts, oldClub], groups: [retired] },
      [sums(oldClub, 400, 0)],
    );

    expect(built?.expense.rows[1]).toEqual({
      kind: 'group',
      group: retired.id,
      name: 'Retired',
      total: 400,
      accounts: [row(oldClub, 400)],
    });
  });

  it('refuses sums whose totals come out beyond what an amount can hold', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const other = account(6, 'revenue', 'Other sales');
    const twoAccounts = { ...STARTING, accounts: [...STARTING.accounts, other] };
    const grouped = { ...SALES, groupId: FOOD.id };
    const otherGrouped = { ...other, groupId: FOOD.id };
    const salaryGroup = { ...FOOD, accountType: 'revenue' } satisfies AccountGroup;
    const oneGroup = {
      accounts: [CASH, EXPENSES, grouped, otherGrouped],
      groups: [salaryGroup],
    };

    for (const [chart, named] of [
      [STARTING, [sums(SALES, -1, big)]],
      [STARTING, [sums(EXPENSES, big, -1)]],
      [twoAccounts, [sums(SALES, 0, big), sums(other, 0, big)]],
      [STARTING, [sums(SALES, 0, big), sums(EXPENSES, 0, big)]],
      [oneGroup, [sums(grouped, 0, big), sums(otherGrouped, 0, big)]],
    ] as const) {
      const built = incomeStatement(chart, JUNE, named);

      expect(!built.ok && built.error.code).toBe('INVALID_INPUT');
    }
  });
});
