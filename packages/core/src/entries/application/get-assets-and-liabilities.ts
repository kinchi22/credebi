import { type DomainError, type Result } from '@repo/contracts';
import { parseDay } from '../../accounts/domain/account';
import { type AccountRepository } from '../../accounts/ports/account-repository';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import {
  assetsAndLiabilities,
  type AssetsAndLiabilities,
} from '../domain/assets-and-liabilities';
import { type EntryRepository } from '../ports/entry-repository';

export type GetAssetsAndLiabilitiesDependencies = {
  readonly entries: EntryRepository;
  readonly accounts: AccountRepository;
};

export type GetAssetsAndLiabilities = (
  auth: AuthContext,
  day: string,
) => Promise<Result<AssetsAndLiabilities, DomainError>>;

export function createGetAssetsAndLiabilities({
  entries,
  accounts,
}: GetAssetsAndLiabilitiesDependencies): GetAssetsAndLiabilities {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const day = parseDay(draft);
    if (!day.ok) {
      return day;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const sums = await entries.accountTotals(userId.value, { to: day.value });
    if (!sums.ok) {
      return sums;
    }

    return assetsAndLiabilities(chart.value, day.value, sums.value);
  };
}
