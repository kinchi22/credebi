import {
  addAccountGroupInputSchema,
  addAccountInputSchema,
  chartSchema,
  editAccountGroupInputSchema,
  editAccountInputSchema,
  toChart,
} from '@repo/contracts';
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

  add: sessionProcedure
    .input(addAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.addAccount(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
    }),

  edit: sessionProcedure
    .input(editAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.editAccount(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
    }),

  addGroup: sessionProcedure
    .input(addAccountGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.addAccountGroup(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
    }),

  editGroup: sessionProcedure
    .input(editAccountGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.editAccountGroup(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
    }),
});
