import { ok, type DomainError, type Money, type Result } from '@repo/contracts';
import { chartInOrder, type Account, type Chart } from '../../accounts/domain/account';
import { isActiveWithin } from '../../accounts/domain/active-period';
import { addMoney, negateMoney } from '../../money/domain/money';
import { type DayRange } from './search-range';
import {
  statementSection,
  sumsByAccount,
  type AccountSums,
  type StatementSection,
} from './statement';

export type IncomeStatement = {
  readonly revenue: StatementSection;
  readonly expense: StatementSection;
  readonly netIncome: Money;
};

export function incomeStatement(
  chart: Chart,
  range: DayRange,
  sums: readonly AccountSums[],
): Result<IncomeStatement, DomainError> {
  const nodes = chartInOrder(chart);
  const scope = {
    includes: (account: Account, named: AccountSums | undefined) =>
      named !== undefined || isActiveWithin(account, range),
    sums: sumsByAccount(sums),
  };
  const revenue = statementSection(nodes, { ...scope, accountType: 'revenue' });
  if (!revenue.ok) {
    return revenue;
  }
  const expense = statementSection(nodes, { ...scope, accountType: 'expense' });
  if (!expense.ok) {
    return expense;
  }
  const netIncome = addMoney(revenue.value.total, negateMoney(expense.value.total));
  return netIncome.ok
    ? ok({ revenue: revenue.value, expense: expense.value, netIncome: netIncome.value })
    : netIncome;
}
