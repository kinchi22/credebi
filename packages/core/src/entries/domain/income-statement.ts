import {
  ok,
  type AccountId,
  type AccountType,
  type DomainError,
  type Money,
  type Result,
} from '@repo/contracts';
import { chartInOrder, type Account, type Chart } from '../../accounts/domain/account';
import { isActiveWithin } from '../../accounts/domain/active-period';
import { addMoney, MONEY_ZERO, negateMoney, sumMoney } from '../../money/domain/money';
import { type DayRange } from './search-range';

export type AccountSums = {
  readonly account: AccountId;
  readonly debit: Money;
  readonly credit: Money;
};

export type StatementAccount = {
  readonly kind: 'account';
  readonly account: AccountId;
  readonly name: string;
  readonly total: Money;
};

export type StatementSection = {
  readonly total: Money;
  readonly rows: readonly StatementAccount[];
};

export type IncomeStatement = {
  readonly revenue: StatementSection;
  readonly expense: StatementSection;
  readonly difference: Money;
};

type StatementType = Extract<AccountType, 'revenue' | 'expense'>;

const NO_SUMS = { debit: MONEY_ZERO, credit: MONEY_ZERO };

const TOTAL_BY_TYPE: Readonly<
  Record<StatementType, (sums: Pick<AccountSums, 'debit' | 'credit'>) => Result<Money, DomainError>>
> = {
  revenue: ({ debit, credit }) => addMoney(credit, negateMoney(debit)),
  expense: ({ debit, credit }) => addMoney(debit, negateMoney(credit)),
};

function accountsInOrder(chart: Chart): readonly Account[] {
  return chartInOrder(chart).flatMap((node) =>
    node.kind === 'account' ? [node.account] : node.accounts,
  );
}

function section(
  accounts: readonly Account[],
  accountType: StatementType,
  range: DayRange,
  sums: ReadonlyMap<AccountId, AccountSums>,
): Result<StatementSection, DomainError> {
  const rows: StatementAccount[] = [];
  for (const account of accounts) {
    const named = sums.get(account.id);
    const listed =
      account.accountType === accountType &&
      (named !== undefined || isActiveWithin(account, range));
    if (listed) {
      const total = TOTAL_BY_TYPE[accountType](named ?? NO_SUMS);
      if (!total.ok) {
        return total;
      }
      rows.push({ kind: 'account', account: account.id, name: account.name, total: total.value });
    }
  }
  const total = sumMoney(rows.map((row) => row.total));
  return total.ok ? ok({ total: total.value, rows }) : total;
}

export function incomeStatement(
  chart: Chart,
  range: DayRange,
  sums: readonly AccountSums[],
): Result<IncomeStatement, DomainError> {
  const accounts = accountsInOrder(chart);
  const byAccount = new Map(sums.map((named) => [named.account, named]));
  const revenue = section(accounts, 'revenue', range, byAccount);
  if (!revenue.ok) {
    return revenue;
  }
  const expense = section(accounts, 'expense', range, byAccount);
  if (!expense.ok) {
    return expense;
  }
  const difference = addMoney(revenue.value.total, negateMoney(expense.value.total));
  return difference.ok
    ? ok({ revenue: revenue.value, expense: expense.value, difference: difference.value })
    : difference;
}
