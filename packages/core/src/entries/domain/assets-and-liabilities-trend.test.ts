import { describe, expect, it } from 'vitest';
import { isErr, type AccountId, type AccountType, type Money } from '@repo/contracts';
import { type Account, type Chart } from '../../accounts/domain/account';
import {
  assetsAndLiabilitiesTrend,
  daysOfRange,
  makeMonthRange,
  monthRangeOf,
  monthsOf,
  MOST_TREND_MONTHS,
  type MonthRange,
  type MonthSums,
  type TrendSums,
} from './assets-and-liabilities-trend';
import { type AccountSums } from './statement';

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

const withAccounts = (...added: readonly Account[]): Chart => ({
  ...STARTING,
  accounts: [...STARTING.accounts, ...added],
});

const sums = (of: Account, debit: number, credit: number): AccountSums => ({
  account: of.id,
  debit: debit as Money,
  credit: credit as Money,
});

const moved = (month: string, of: Account, debit: number, credit: number): MonthSums => ({
  month,
  ...sums(of, debit, credit),
});

const NOTHING: TrendSums = { opening: [], months: [] };

const range = (from: string, to: string): MonthRange => ({ from, to });

type Row = readonly [month: string, totalAssets: number, totalLiabilities: number, netWorth: number];

const rowsOf = (chart: Chart, asked: MonthRange, read: TrendSums): readonly Row[] | string => {
  const built = assetsAndLiabilitiesTrend(chart, asked, read);
  return built.ok
    ? built.value.months.map(({ month, totalAssets, totalLiabilities, netWorth }) => [
        month,
        totalAssets,
        totalLiabilities,
        netWorth,
      ])
    : built.error.code;
};

describe('makeMonthRange', () => {
  it('accepts a range of one month, and one whose last month is far ahead', () => {
    expect(makeMonthRange(range('2026-06', '2026-06'))).toEqual({ ok: true, value: range('2026-06', '2026-06') });
    expect(makeMonthRange(range('2026-06', '2075-05'))).toEqual({ ok: true, value: range('2026-06', '2075-05') });
  });

  it(`accepts a range of exactly ${String(MOST_TREND_MONTHS)} months and refuses one month more`, () => {
    expect(MOST_TREND_MONTHS).toBe(600);
    expect(makeMonthRange(range('1980-01', '2029-12')).ok).toBe(true);

    const tooLong = makeMonthRange(range('1980-01', '2030-01'));

    expect(isErr(tooLong) && tooLong.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A range of months can cover at most 600 months.',
    });
  });

  it('refuses a range whose first month is later than its last', () => {
    const reversed = makeMonthRange(range('2026-07', '2026-06'));

    expect(isErr(reversed) && reversed.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A range of months cannot end (2026-06) before it starts (2026-07).',
    });
  });

  it.each([
    ['a first month that is no calendar month', range('2026-13', '2027-01'), '"2026-13" is not a calendar month.'],
    ['a last month that is a calendar day', range('2026-06', '2026-06-30'), '"2026-06-30" is not a calendar month.'],
    ['an empty month', range('', '2026-06'), '"" is not a calendar month.'],
  ])('refuses %s', (_case, asked, message) => {
    const made = makeMonthRange(asked);

    expect(isErr(made) && made.error).toEqual({ code: 'INVALID_INPUT', message });
  });
});

describe('monthsOf', () => {
  it('lists every month of the range in order, across a year end, both ends included', () => {
    expect(monthsOf(range('2025-11', '2026-02'))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('lists a single month for a range of one', () => {
    expect(monthsOf(range('2026-06', '2026-06'))).toEqual(['2026-06']);
  });

  it('keeps four digits in a year before 1000', () => {
    expect(monthsOf(range('0999-12', '1000-01'))).toEqual(['0999-12', '1000-01']);
  });

  it(`lists all ${String(MOST_TREND_MONTHS)} months of the longest range`, () => {
    const months = monthsOf(range('1980-01', '2029-12'));

    expect(months).toHaveLength(600);
    expect(months.at(0)).toBe('1980-01');
    expect(months.at(-1)).toBe('2029-12');
  });
});

describe('daysOfRange', () => {
  it("runs a single month from its first day to its last, a leap February included", () => {
    expect(daysOfRange(range('2024-02', '2024-02'))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(daysOfRange(range('2026-02', '2026-02'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it("runs across a year end", () => {
    expect(daysOfRange(range('2025-11', '2026-01'))).toEqual({ from: '2025-11-01', to: '2026-01-31' });
  });

  it("runs a range of months from its first month's first day to its last month's last day", () => {
    expect(daysOfRange(range('2026-06', '2026-09'))).toEqual({ from: '2026-06-01', to: '2026-09-30' });
  });
});

describe('monthRangeOf', () => {
  it('names the month of the first day and the month of the last', () => {
    expect(monthRangeOf({ from: '2025-11-01', to: '2026-01-31' })).toEqual(range('2025-11', '2026-01'));
    expect(monthRangeOf({ from: '2026-06-16', to: '2026-06-30' })).toEqual(range('2026-06', '2026-06'));
  });

  it('gives back the months a range of months covers', () => {
    expect(monthRangeOf(daysOfRange(range('0995-02', '2075-12')))).toEqual(range('0995-02', '2075-12'));
  });
});

describe('assetsAndLiabilitiesTrend', () => {
  it("accumulates each month's balances from the opening amount through that month, rather than taking its movement", () => {
    expect(
      rowsOf(STARTING, range('2026-06', '2026-08'), {
        opening: [sums(CASH, 1000, 0)],
        months: [moved('2026-07', CASH, 10000, 3000), moved('2026-08', CASH, 0, 500)],
      }),
    ).toEqual([
      ['2026-06', 1000, 0, 1000],
      ['2026-07', 8000, 0, 8000],
      ['2026-08', 7500, 0, 7500],
    ]);
  });

  it('balances an asset Account as its debits less its credits and a liability Account as its credits less its debits', () => {
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [],
        months: [moved('2026-06', CASH, 10000, 3000), moved('2026-06', PAYABLE, 500, 4000)],
      }),
    ).toEqual([['2026-06', 7000, 3500, 3500]]);
  });

  it('keeps the minus sign of a negative balance and a negative Net worth', () => {
    const card = account(6, 'liability', 'Card');

    expect(
      rowsOf(withAccounts(card), range('2026-06', '2026-06'), {
        opening: [sums(CASH, 1000, 5000), sums(PAYABLE, 1200, 0), sums(card, 0, 9000)],
        months: [],
      }),
    ).toEqual([['2026-06', -4000, 7800, -11800]]);
  });

  it('sums every asset Account and every liability Account into its total, each counted once', () => {
    const bank = account(6, 'asset', 'Bank');
    const loan = account(7, 'liability', 'Loan');

    expect(
      rowsOf(withAccounts(bank, loan), range('2026-06', '2026-06'), {
        opening: [sums(CASH, 300, 0), sums(loan, 0, 50)],
        months: [moved('2026-06', bank, 2000, 0), moved('2026-06', PAYABLE, 0, 70)],
      }),
    ).toEqual([['2026-06', 2300, 120, 2180]]);
  });

  it('leaves equity, revenue and expense Accounts out of every total', () => {
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CAPITAL, 0, 2000), sums(SALES, 0, 3000)],
        months: [moved('2026-06', EXPENSES, 1000, 0), moved('2026-06', CASH, 5000, 1000)],
      }),
    ).toEqual([['2026-06', 4000, 0, 4000]]);
  });

  it('counts an Account from the month its Active period starts, even on that month\'s last day, and not in the month before', () => {
    const wallet = account(6, 'asset', 'Wallet', { activeFrom: '2026-06-30' });

    expect(
      rowsOf(withAccounts(wallet), range('2026-05', '2026-07'), {
        opening: [sums(wallet, 4000, 0)],
        months: [],
      }),
    ).toEqual([
      ['2026-05', 0, 0, 0],
      ['2026-06', 4000, 0, 4000],
      ['2026-07', 4000, 0, 4000],
    ]);
  });

  it('counts an Account in every month its Active period overlaps, even by its first day, and from the month after it ends leaves it out', () => {
    const fund = account(6, 'asset', 'Short fund', { activeUntil: '2026-07-01' });
    const loan = account(7, 'liability', 'Old loan', { activeUntil: '2026-06-15' });

    expect(
      rowsOf(withAccounts(fund, loan), range('2026-06', '2026-08'), {
        opening: [],
        months: [moved('2026-06', fund, 500, 0), moved('2026-06', loan, 0, 3000)],
      }),
    ).toEqual([
      ['2026-06', 500, 3000, -2500],
      ['2026-07', 500, 0, 500],
      ['2026-08', 0, 0, 0],
    ]);
  });

  it('answers a month for every month of the range, with zeros where nothing is recorded yet', () => {
    expect(rowsOf(STARTING, range('2026-11', '2027-01'), NOTHING)).toEqual([
      ['2026-11', 0, 0, 0],
      ['2026-12', 0, 0, 0],
      ['2027-01', 0, 0, 0],
    ]);
  });

  it('says nothing is recorded only when no Account has any amount on or before the last month', () => {
    const recorded = (read: TrendSums): boolean | undefined => {
      const built = assetsAndLiabilitiesTrend(STARTING, range('2026-06', '2026-08'), read);
      return built.ok ? built.value.recorded : undefined;
    };

    expect(recorded(NOTHING)).toBe(false);
    expect(recorded({ opening: [sums(CAPITAL, 0, 1)], months: [] })).toBe(true);
    expect(recorded({ opening: [], months: [moved('2026-08', EXPENSES, 1, 0)] })).toBe(true);
  });

  it('refuses balances beyond what an amount can hold', () => {
    const huge = Number.MAX_SAFE_INTEGER;

    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CASH, huge, 0)],
        months: [moved('2026-06', CASH, huge, 0)],
      }),
    ).toBe('INVALID_INPUT');
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CASH, 0, huge)],
        months: [moved('2026-06', CASH, 0, huge)],
      }),
    ).toBe('INVALID_INPUT');
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CASH, huge, 0), sums(PAYABLE, huge, 0)],
        months: [],
      }),
    ).toBe('INVALID_INPUT');
  });

  it('refuses sums beyond what an amount can hold on an Account no total counts, in the opening amount or a month', () => {
    const huge = Number.MAX_SAFE_INTEGER;

    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CAPITAL, 0, huge), sums(CAPITAL, 0, huge)],
        months: [],
      }),
    ).toBe('INVALID_INPUT');
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(EXPENSES, huge, 0)],
        months: [moved('2026-06', EXPENSES, huge, 0)],
      }),
    ).toBe('INVALID_INPUT');
    expect(
      rowsOf(STARTING, range('2026-06', '2026-06'), {
        opening: [sums(CAPITAL, 0, huge)],
        months: [moved('2026-06', CAPITAL, 0, huge)],
      }),
    ).toBe('INVALID_INPUT');
  });
});
