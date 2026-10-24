import { type DomainError, type Result } from '@repo/contracts';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { incomeStatement, type IncomeStatement } from '../domain/income-statement';
import { makeDayRange, type DayRange } from '../domain/search-range';
import { type EntryRepository } from '../ports/entry-repository';

export type GetIncomeStatementDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
};

export type GetIncomeStatement = (
  auth: AuthContext,
  range: DayRange,
) => Promise<Result<IncomeStatement, DomainError>>;

export function createGetIncomeStatement({
  entries,
  accounts,
}: GetIncomeStatementDependencies): GetIncomeStatement {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const range = makeDayRange(draft);
    if (!range.ok) {
      return range;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const sums = await entries.accountTotals(userId.value, range.value);
    if (!sums.ok) {
      return sums;
    }

    return incomeStatement(chart.value, range.value, sums.value);
  };
}
