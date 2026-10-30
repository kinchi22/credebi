import { ok, type ChartId, type UserId } from '@repo/contracts';
import { type ChartView } from '../domain/chart-view';
import { type ChartViewRepository } from '../ports/chart-view-repository';

export function inMemoryChartViews(): ChartViewRepository {
  const stored = new Map<string, ChartView>();
  const keyOf = (userId: UserId, chartId: ChartId): string => JSON.stringify([userId, chartId]);

  return {
    read: (userId, chartId) => Promise.resolve(ok(stored.get(keyOf(userId, chartId)))),
    save: (userId, chartId, view) => {
      stored.set(keyOf(userId, chartId), view);
      return Promise.resolve(ok(undefined));
    },
  };
}
