import { chartSchema, toChart } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

export const accountsRouter = router({
  chart: sessionProcedure.output(chartSchema).query(async ({ ctx }) => {
    const result = await ctx.container.getChart(ctx.auth);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
    return toChart(result.value);
  }),
});
