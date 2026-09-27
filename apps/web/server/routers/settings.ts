import { changeEntryFormModeInputSchema, settingsSchema, toSettings } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

export const settingsRouter = router({
  read: sessionProcedure.output(settingsSchema).query(async ({ ctx }) => {
    const result = await ctx.container.getSettings(ctx.auth);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
    return toSettings(result.value);
  }),

  changeEntryFormMode: sessionProcedure
    .input(changeEntryFormModeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.changeEntryFormMode(ctx.auth, input.entryFormMode);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
    }),
});
