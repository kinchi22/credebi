import { type ChartId, type DomainError, type Result, type UserId } from '@repo/contracts';
import { type ChartView } from '../domain/chart-view';

export type ChartViewRepository = {
  readonly read: (userId: UserId, chartId: ChartId) => Promise<Result<ChartView | undefined, DomainError>>;
  readonly save: (userId: UserId, chartId: ChartId, view: ChartView) => Promise<Result<void, DomainError>>;
};
