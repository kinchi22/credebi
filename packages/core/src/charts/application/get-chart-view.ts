import { ok, type ChartId, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { defaultChartView, type ChartView } from '../domain/chart-view';
import { type ChartViewRepository } from '../ports/chart-view-repository';

export type GetChartViewDependencies = {
  readonly chartViews: ChartViewRepository;
};

export type GetChartView = (auth: AuthContext, chartId: ChartId) => Promise<Result<ChartView, DomainError>>;

export function createGetChartView({ chartViews }: GetChartViewDependencies): GetChartView {
  return async (auth, chartId) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const stored = await chartViews.read(userId.value, chartId);
    return ok((stored.ok ? stored.value : undefined) ?? defaultChartView(chartId));
  };
}
