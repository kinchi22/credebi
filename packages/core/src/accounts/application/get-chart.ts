import { ok, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { chartOutline, type ChartNode } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type GetChartDependencies = {
  readonly accounts: AccountRepository;
};

export type GetChart = (auth: AuthContext) => Promise<Result<readonly ChartNode[], DomainError>>;

export function createGetChart({ accounts }: GetChartDependencies): GetChart {
  return async (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const chart = await accounts.readChart(userId.value);
    return chart.ok ? ok(chartOutline(chart.value)) : chart;
  };
}
