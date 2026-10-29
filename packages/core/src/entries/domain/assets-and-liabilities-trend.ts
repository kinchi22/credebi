import {
  calendarMonthSchema,
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Err,
  type Money,
  type Result,
} from '@repo/contracts';
import { chartInOrder, type Account, type Chart, type ChartNode } from '../../accounts/domain/account';
import { isActiveWithin } from '../../accounts/domain/active-period';
import { addMoney, MONEY_ZERO } from '../../money/domain/money';
import { assetsAndLiabilitiesWhere } from './assets-and-liabilities';
import { calendarDay, calendarMonth, monthOf, monthsRange, yearOf, type DayRange } from './search-range';
import { type AccountSums } from './statement';

export const MOST_TREND_MONTHS = 600;

export type MonthRange = {
  readonly from: string;
  readonly to: string;
};

export type MonthSums = AccountSums & {
  readonly month: string;
};

export type TrendSums = {
  readonly opening: readonly AccountSums[];
  readonly months: readonly MonthSums[];
};

export type TrendMonth = {
  readonly month: string;
  readonly totalAssets: Money;
  readonly totalLiabilities: Money;
  readonly netWorth: Money;
};

export type AssetsAndLiabilitiesTrend = {
  readonly months: readonly TrendMonth[];
  readonly recorded: boolean;
};

const indexOf = (month: string): number => yearOf(month) * 12 + monthOf(month) - 1;

const monthAt = (index: number): string =>
  calendarDay(Math.floor(index / 12), index % 12, 1).slice(0, 7);

const countOf = (range: MonthRange): number => indexOf(range.to) - indexOf(range.from) + 1;

export function daysOfRange(range: MonthRange): DayRange {
  return monthsRange(yearOf(range.from), monthOf(range.from) - 1, countOf(range));
}

export function monthRangeOf(range: DayRange): MonthRange {
  return { from: range.from.slice(0, 7), to: range.to.slice(0, 7) };
}

export function monthsOf(range: MonthRange): readonly string[] {
  const first = indexOf(range.from);
  return Array.from({ length: countOf(range) }, (_, offset) => monthAt(first + offset));
}

const refused = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

export function makeMonthRange({ from, to }: MonthRange): Result<MonthRange, DomainError> {
  for (const month of [from, to]) {
    if (!calendarMonthSchema.safeParse(month).success) {
      return refused(`"${month}" is not a calendar month.`);
    }
  }
  if (from > to) {
    return refused(`A range of months cannot end (${to}) before it starts (${from}).`);
  }
  if (countOf({ from, to }) > MOST_TREND_MONTHS) {
    return refused(`A range of months can cover at most ${String(MOST_TREND_MONTHS)} months.`);
  }
  return ok({ from, to });
}

type Balances = Map<AccountId, AccountSums>;

function addInto(balances: Balances, { account, debit, credit }: AccountSums): Result<void, DomainError> {
  const held = balances.get(account) ?? { account, debit: MONEY_ZERO, credit: MONEY_ZERO };
  const debits = addMoney(held.debit, debit);
  if (!debits.ok) {
    return debits;
  }
  const credits = addMoney(held.credit, credit);
  if (!credits.ok) {
    return credits;
  }
  balances.set(account, { account, debit: debits.value, credit: credits.value });
  return ok(undefined);
}

function addAllInto(balances: Balances, sums: readonly AccountSums[]): Result<void, DomainError> {
  for (const named of sums) {
    const added = addInto(balances, named);
    if (!added.ok) {
      return added;
    }
  }
  return ok(undefined);
}

function byMonth(sums: readonly MonthSums[]): ReadonlyMap<string, readonly MonthSums[]> {
  const grouped = new Map<string, MonthSums[]>();
  for (const named of sums) {
    grouped.set(named.month, [...(grouped.get(named.month) ?? []), named]);
  }
  return grouped;
}

function valuesOf(
  nodes: readonly ChartNode[],
  month: string,
  balances: Balances,
): Result<TrendMonth, DomainError> {
  const days = calendarMonth(month);
  const values = assetsAndLiabilitiesWhere(nodes, {
    includes: (account: Account) => isActiveWithin(account, days),
    sums: balances,
  });
  return values.ok
    ? ok({
        month,
        totalAssets: values.value.assets.total,
        totalLiabilities: values.value.liabilities.total,
        netWorth: values.value.netWorth,
      })
    : values;
}

export function assetsAndLiabilitiesTrend(
  chart: Chart,
  range: MonthRange,
  sums: TrendSums,
): Result<AssetsAndLiabilitiesTrend, DomainError> {
  const nodes = chartInOrder(chart);
  const balances: Balances = new Map();
  const opened = addAllInto(balances, sums.opening);
  if (!opened.ok) {
    return opened;
  }
  const movements = byMonth(sums.months);
  const months: TrendMonth[] = [];
  for (const month of monthsOf(range)) {
    const moved = addAllInto(balances, movements.get(month) ?? []);
    if (!moved.ok) {
      return moved;
    }
    const values = valuesOf(nodes, month, balances);
    if (!values.ok) {
      return values;
    }
    months.push(values.value);
  }
  return ok({ months, recorded: sums.opening.length > 0 || sums.months.length > 0 });
}
