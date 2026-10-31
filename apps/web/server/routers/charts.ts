import {
  changeChartViewInputSchema,
  chartViewInputSchema,
  chartViewSchema,
  toChartView,
} from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

export const chartsRouter = router({
  view: sessionProcedure
    .input(chartViewInputSchema)
    .output(chartViewSchema)
    .query(async ({ ctx, input }) => {
      const result = await ctx.container.getChartView(ctx.auth, input.chartId);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toChartView(result.value);
    }),

  changeView: sessionProcedure.input(changeChartViewInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.changeChartView(ctx.auth, input.chartId, input.shownSeriesIds);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
  }),
});
