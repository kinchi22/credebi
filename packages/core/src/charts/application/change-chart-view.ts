import { type ChartId, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { makeChartView } from '../domain/chart-view';
import { type ChartViewRepository } from '../ports/chart-view-repository';

export type ChangeChartViewDependencies = {
  readonly chartViews: ChartViewRepository;
};

export type ChangeChartView = (
  auth: AuthContext,
  chartId: ChartId,
  shownSeriesIds: readonly string[],
) => Promise<Result<void, DomainError>>;

export function createChangeChartView({ chartViews }: ChangeChartViewDependencies): ChangeChartView {
  return async (auth, chartId, shownSeriesIds) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const view = makeChartView(chartId, shownSeriesIds);
    if (!view.ok) {
      return view;
    }
    return chartViews.save(userId.value, chartId, view.value);
  };
}
