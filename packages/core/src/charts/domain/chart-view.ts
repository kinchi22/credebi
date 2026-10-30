import {
  domainError,
  err,
  ok,
  trendSeriesSchema,
  type ChartId,
  type DomainError,
  type Result,
} from '@repo/contracts';

export type ChartView = {
  readonly shownSeriesIds: readonly string[];
};

const SERIES_OF: { readonly [Chart in ChartId]: readonly string[] } = {
  'assets-and-liabilities-trend': trendSeriesSchema.options,
};

export function defaultChartView(chartId: ChartId): ChartView {
  return { shownSeriesIds: SERIES_OF[chartId] };
}

export function makeChartView(
  chartId: ChartId,
  shownSeriesIds: readonly string[],
): Result<ChartView, DomainError> {
  const series = SERIES_OF[chartId];
  const foreign = shownSeriesIds.some((id) => !series.includes(id));
  const repeated = new Set(shownSeriesIds).size !== shownSeriesIds.length;
  if (foreign || repeated) {
    return err(
      domainError('INVALID_INPUT', `A Chart view of ${chartId} shows only that chart's series, each once.`),
    );
  }
  return ok({ shownSeriesIds: series.filter((id) => shownSeriesIds.includes(id)) });
}
