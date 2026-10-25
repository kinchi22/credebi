import { describe, expect, it } from 'vitest';
import {
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type Money,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../../accounts/domain/account';
import { assetsAndLiabilities, type AssetsAndLiabilities } from './assets-and-liabilities';
import { type AccountSums } from './statement';

const JUNE_LAST = '2026-06-30';

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

const STARTING: Chart = { accounts: [CASH, PAYABLE, CAPITAL, SALES, EXPENSES], groups: [] };

const withAccounts = (...added: readonly Account[]): Chart => ({
  ...STARTING,
  accounts: [...STARTING.accounts, ...added],
});

const sums = (of: Account, debit: number, credit: number): AccountSums => ({
  account: of.id,
  debit: debit as Money,
  credit: credit as Money,
});

const reportOf = (
  chart: Chart,
  named: readonly AccountSums[],
  day = JUNE_LAST,
): AssetsAndLiabilities | undefined => {
  const built = assetsAndLiabilities(chart, day, named);
  expect(built.ok, 'the report was built').toBe(true);
  return built.ok ? built.value : undefined;
};

const row = (of: Account, total: number) => ({
  kind: 'account',
  account: of.id,
  name: of.name,
  total,
});

const outline = (rows: AssetsAndLiabilities['assets']['rows'] | undefined) =>
  rows?.flatMap((listed) =>
    listed.kind === 'group' ? [listed.name, listed.accounts.map(({ name }) => name)] : [listed.name],
  );

const rowsIn = (built: AssetsAndLiabilities | undefined) => ({
  assets: outline(built?.assets.rows),
  liabilities: outline(built?.liabilities.rows),
});

describe('assetsAndLiabilities', () => {
  it('balances an asset Account as its debits less its credits and a liability Account as its credits less its debits', () => {
    const built = reportOf(STARTING, [sums(CASH, 10000, 3000), sums(PAYABLE, 500, 4000)]);

    expect(built).toEqual({
      assets: { total: 7000, rows: [row(CASH, 7000)] },
      liabilities: { total: 3500, rows: [row(PAYABLE, 3500)] },
      netWorth: 3500,
    });
  });

  it('keeps the minus sign of a negative balance, a negative total and a negative Net worth', () => {
    const built = reportOf(STARTING, [sums(CASH, 1000, 3500), sums(PAYABLE, 1200, 0)]);

    expect(built).toEqual({
      assets: { total: -2500, rows: [row(CASH, -2500)] },
      liabilities: { total: -1200, rows: [row(PAYABLE, -1200)] },
      netWorth: -1300,
    });
  });

  it('takes Net worth as total assets less total liabilities when the liabilities are larger', () => {
    const card = account(6, 'liability', 'Card');
    const built = reportOf(withAccounts(card), [
      sums(CASH, 5000, 0),
      sums(PAYABLE, 0, 2000),
      sums(card, 0, 9000),
    ]);

    expect(built?.liabilities.total).toBe(11000);
    expect(built?.netWorth).toBe(-6000);
  });

  it('lists every asset and liability Account active on the day at zero, with zero totals, when nothing is summed', () => {
    expect(reportOf(STARTING, [])).toEqual({
      assets: { total: 0, rows: [row(CASH, 0)] },
      liabilities: { total: 0, rows: [row(PAYABLE, 0)] },
      netWorth: 0,
    });
  });

  it('shows both sections, empty and at zero, on a day no Account is active', () => {
    expect(reportOf(STARTING, [sums(CASH, 400, 0)], '2025-12-31')).toEqual({
      assets: { total: 0, rows: [] },
      liabilities: { total: 0, rows: [] },
      netWorth: 0,
    });
  });

  it('leaves out equity, revenue and expense Accounts, even when the sums name them', () => {
    const built = reportOf(STARTING, [
      sums(CAPITAL, 0, 100),
      sums(SALES, 0, 100),
      sums(EXPENSES, 100, 0),
    ]);

    expect(rowsIn(built)).toEqual({ assets: ['Cash'], liabilities: ['Accounts payable'] });
    expect(built?.netWorth).toBe(0);
  });

  it('lists an Account on the first and the last day of its Active period', () => {
    const wallet = account(6, 'asset', 'Wallet', { activeFrom: '2026-06-10', activeUntil: '2026-06-20' });
    const tab = account(7, 'liability', 'Tab', { activeFrom: '2026-06-10', activeUntil: '2026-06-20' });

    for (const day of ['2026-06-10', '2026-06-20']) {
      expect(rowsIn(reportOf(withAccounts(wallet, tab), [], day))).toEqual({
        assets: ['Cash', 'Wallet'],
        liabilities: ['Accounts payable', 'Tab'],
      });
    }
  });

  it('leaves out an Account the day before it starts and the day after it ends', () => {
    const wallet = account(6, 'asset', 'Wallet', { activeFrom: '2026-06-10', activeUntil: '2026-06-20' });
    const tab = account(7, 'liability', 'Tab', { activeFrom: '2026-06-10', activeUntil: '2026-06-20' });

    for (const day of ['2026-06-09', '2026-06-21']) {
      expect(rowsIn(reportOf(withAccounts(wallet, tab), [], day))).toEqual({
        assets: ['Cash'],
        liabilities: ['Accounts payable'],
      });
    }
  });

  it('leaves an inactive Account with a balance out of its row, its group subtotal, both totals and Net worth', () => {
    const savings = group(1, 'asset', 'Savings', 9);
    const deposit = account(6, 'asset', 'Deposit', { groupId: savings.id, activeUntil: JUNE_LAST });
    const fund = account(7, 'asset', 'Fund', { groupId: savings.id });
    const oldLoan = account(8, 'liability', 'Old loan', { activeUntil: JUNE_LAST });
    const notYet = account(9, 'asset', 'Not yet', { activeFrom: '2026-07-02' });
    const chart = { accounts: [...STARTING.accounts, deposit, fund, oldLoan, notYet], groups: [savings] };
    const named = [sums(deposit, 4000, 0), sums(fund, 1000, 0), sums(oldLoan, 0, 3000), sums(notYet, 800, 0)];

    expect(reportOf(chart, named, '2026-07-01')).toEqual({
      assets: {
        total: 1000,
        rows: [
          row(CASH, 0),
          { kind: 'group', group: savings.id, name: 'Savings', total: 1000, accounts: [row(fund, 1000)] },
        ],
      },
      liabilities: { total: 0, rows: [row(PAYABLE, 0)] },
      netWorth: 1000,
    });
  });

  it("puts each Account under its group with the group's subtotal and counts it once in the total, in Chart of accounts order", () => {
    const banks = group(1, 'asset', 'Banks', 1);
    const loans = group(2, 'liability', 'Loans', 0);
    const checking = account(6, 'asset', 'Checking', { groupId: banks.id, position: 1 });
    const saving = account(7, 'asset', 'Savings account', { groupId: banks.id, position: 0 });
    const wallet = account(8, 'asset', 'Wallet', { position: 2 });
    const mortgage = account(9, 'liability', 'Mortgage', { groupId: loans.id });
    const built = reportOf(
      {
        accounts: [{ ...CASH, position: 0 }, ...STARTING.accounts.slice(1), checking, saving, wallet, mortgage],
        groups: [banks, loans],
      },
      [sums(CASH, 9000, 0), sums(checking, 2000, 0), sums(saving, 3000, 0), sums(mortgage, 0, 10000)],
    );

    expect(built?.assets).toEqual({
      total: 14000,
      rows: [
        row(CASH, 9000),
        {
          kind: 'group',
          group: banks.id,
          name: 'Banks',
          total: 5000,
          accounts: [row(saving, 3000), row(checking, 2000)],
        },
        row(wallet, 0),
      ],
    });
    expect(rowsIn(built).liabilities).toEqual(['Loans', ['Mortgage'], 'Accounts payable']);
    expect(built?.liabilities.total).toBe(10000);
    expect(built?.netWorth).toBe(4000);
  });

  it('leaves out a group with no Account, and one whose every Account is inactive on the day', () => {
    const empty = group(1, 'asset', 'Empty', 8);
    const retired = group(2, 'asset', 'Retired', 9);
    const oldCard = account(6, 'asset', 'Old card', { groupId: retired.id, activeUntil: '2026-05-31' });

    const built = reportOf({ accounts: [...STARTING.accounts, oldCard], groups: [empty, retired] }, [
      sums(oldCard, 600, 0),
    ]);

    expect(rowsIn(built).assets).toEqual(['Cash']);
    expect(built?.assets.total).toBe(0);
  });

  it('refuses sums whose balances or totals come out beyond what an amount can hold', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const bank = account(6, 'asset', 'Bank');

    for (const [chart, named] of [
      [STARTING, [sums(CASH, big, -1)]],
      [STARTING, [sums(PAYABLE, -1, big)]],
      [withAccounts(bank), [sums(CASH, big, 0), sums(bank, big, 0)]],
      [STARTING, [sums(CASH, big, 0), sums(PAYABLE, big, 0)]],
    ] as const) {
      const built = assetsAndLiabilities(chart, JUNE_LAST, named);

      expect(!built.ok && built.error.code).toBe('INVALID_INPUT');
    }
  });
});
