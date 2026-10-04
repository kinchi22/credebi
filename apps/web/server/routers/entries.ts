import {
  deleteEntryInputSchema,
  editEntryInputSchema,
  postEntryInputSchema,
  postedEntrySchema,
  searchCriteriaSchema,
  toPostedEntry,
} from '@repo/contracts';
import { z } from 'zod';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

export const entriesRouter = router({
  search: sessionProcedure
    .input(searchCriteriaSchema.default({}))
    .output(z.array(postedEntrySchema))
    .query(async ({ ctx, input }) => {
      const result = await ctx.container.searchEntries(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return result.value.map((entry) => toPostedEntry(entry));
    }),

  post: sessionProcedure
    .input(postEntryInputSchema)
    .output(postedEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.postEntry(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toPostedEntry(result.value);
    }),

  edit: sessionProcedure
    .input(editEntryInputSchema)
    .output(postedEntrySchema)
    .mutation(async ({ ctx, input: { id, ...draft } }) => {
      const result = await ctx.container.editEntry(ctx.auth, id, draft);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toPostedEntry(result.value);
    }),

  delete: sessionProcedure.input(deleteEntryInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.deleteEntry(ctx.auth, input.id);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
  }),
});
