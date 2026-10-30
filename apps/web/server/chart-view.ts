import {
  changeChartViewInputSchema,
  type ChangeChartViewInput,
  type ChartId,
  type DomainErrorCode,
} from '@repo/contracts';
import { type Logger } from '@repo/core';
import { fromTrpcError } from './domain-error';

export type ChangeChartView = (input: ChangeChartViewInput) => Promise<void>;

function reportRefusal(logger: Logger, chartId: ChartId, code: DomainErrorCode): void {
  logger.error(
    { event: 'charts.change_refused', chartId, code },
    'A change to a Chart view was refused, so it was not kept.',
  );
}

export async function keepChartView(
  change: ChangeChartView,
  logger: Logger,
  chartId: ChartId,
  shownSeriesIds: unknown,
): Promise<void> {
  const input = changeChartViewInputSchema.safeParse({ chartId, shownSeriesIds });
  if (!input.success) {
    reportRefusal(logger, chartId, 'INVALID_INPUT');
    return;
  }

  try {
    await change(input.data);
  } catch (thrown) {
    reportRefusal(logger, chartId, fromTrpcError(thrown).code);
  }
}
