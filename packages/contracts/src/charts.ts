import { z } from 'zod';

export const ASSETS_AND_LIABILITIES_TREND_CHART = 'assets-and-liabilities-trend';

export const chartIdSchema = z.enum([ASSETS_AND_LIABILITIES_TREND_CHART]);
export type ChartId = z.infer<typeof chartIdSchema>;

export const trendSeriesSchema = z.enum(['netWorth', 'totalAssets', 'totalLiabilities']);
export type TrendSeries = z.infer<typeof trendSeriesSchema>;

export const chartViewSchema = z.object({
  shownSeriesIds: z.array(z.string()),
});

export type ChartViewOutput = z.infer<typeof chartViewSchema>;

export const chartViewInputSchema = z.object({
  chartId: chartIdSchema,
});

export type ChartViewInput = z.infer<typeof chartViewInputSchema>;

export const changeChartViewInputSchema = z.object({
  chartId: chartIdSchema,
  shownSeriesIds: z.array(z.string()),
});

export type ChangeChartViewInput = z.infer<typeof changeChartViewInputSchema>;

export function toChartView(view: { readonly shownSeriesIds: readonly string[] }): ChartViewOutput {
  return { shownSeriesIds: [...view.shownSeriesIds] };
}
