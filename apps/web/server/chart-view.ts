import { changeChartViewInputSchema, type ChangeChartViewInput, type ChartId } from '@repo/contracts';
import { type Logger } from '@repo/core';
import { keepChoice } from './choice';

export type ChangeChartView = (input: ChangeChartViewInput) => Promise<void>;

export async function keepChartView(
  change: ChangeChartView,
  logger: Logger,
  chartId: ChartId,
  shownSeriesIds: unknown,
): Promise<void> {
  await keepChoice(
    {
      schema: changeChartViewInputSchema,
      keep: change,
      logger,
      refusal: {
        fields: { event: 'charts.change_refused', chartId },
        message: 'A change to a Chart view was refused, so it was not kept.',
      },
    },
    { chartId, shownSeriesIds },
  );
}
