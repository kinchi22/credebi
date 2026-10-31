import { type DomainError, type Result } from '@repo/contracts';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import {
  assetsAndLiabilitiesTrend,
  makeMonthRange,
  type AssetsAndLiabilitiesTrend,
  type MonthRange,
} from '../domain/assets-and-liabilities-trend';
import { type EntryRepository } from '../ports/entry-repository';

export type GetAssetsAndLiabilitiesTrendDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
};

export type GetAssetsAndLiabilitiesTrend = (
  auth: AuthContext,
  range: MonthRange,
) => Promise<Result<AssetsAndLiabilitiesTrend, DomainError>>;

export function createGetAssetsAndLiabilitiesTrend({
  entries,
  accounts,
}: GetAssetsAndLiabilitiesTrendDependencies): GetAssetsAndLiabilitiesTrend {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const range = makeMonthRange(draft);
    if (!range.ok) {
      return range;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const sums = await entries.monthlyAccountTotals(userId.value, range.value);
    if (!sums.ok) {
      return sums;
    }

    return assetsAndLiabilitiesTrend(chart.value, range.value, sums.value);
  };
}
