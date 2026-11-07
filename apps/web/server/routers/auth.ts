import {
  authorizationInputSchema,
  authorizationOutcomeSchema,
  authorizationRedirectSchema,
  beganSignInSchema,
  finishGoogleSignInInputSchema,
  issuedSessionSchema,
  testSignInInputSchema,
  toAuthorizationOutcome,
  toBeganSignIn,
  toIssuedSession,
} from '@repo/contracts';
import { z } from 'zod';
import { toTrpcError } from '../domain-error';
import { authorizationServerAt } from '../oauth';
import { publicProcedure, router, sessionProcedure } from '../trpc';

export const authRouter = router({
  signedIn: sessionProcedure.output(z.boolean()).query(({ ctx }) => ctx.auth.userId !== undefined),

  testSignInOffered: publicProcedure
    .output(z.boolean())
    .query(({ ctx }) => ctx.container.testSignInOffered),

  beginGoogleSignIn: publicProcedure
    .input(z.object({ redirectUri: z.url() }))
    .output(beganSignInSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.beginGoogleSignIn(new URL(input.redirectUri));
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toBeganSignIn(result.value);
    }),

  finishGoogleSignIn: publicProcedure
    .input(finishGoogleSignInInputSchema)
    .output(issuedSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.finishGoogleSignIn(
        new URL(input.callbackUrl),
        input.pending,
        input.language,
      );
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toIssuedSession(result.value);
    }),

  testSignIn: publicProcedure
    .input(testSignInInputSchema)
    .output(issuedSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.testSignIn(
        input.identifier,
        input.language,
        input.accountsStartOn,
      );
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toIssuedSession(result.value);
    }),

  beginAuthorization: publicProcedure
    .input(authorizationInputSchema)
    .output(authorizationOutcomeSchema)
    .query(async ({ ctx, input }) =>
      toAuthorizationOutcome(
        await ctx.container.beginAuthorization(input.query, authorizationServerAt(input.origin)),
      ),
    ),

  approveAuthorization: sessionProcedure
    .input(authorizationInputSchema)
    .output(authorizationRedirectSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.approveAuthorization(
        ctx.auth,
        input.query,
        authorizationServerAt(input.origin),
      );
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return { location: result.value.href };
    }),

  denyAuthorization: publicProcedure
    .input(authorizationInputSchema)
    .output(authorizationRedirectSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.denyAuthorization(
        input.query,
        authorizationServerAt(input.origin),
      );
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return { location: result.value.href };
    }),

  signOut: publicProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.container.signOut(ctx.sessionToken);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
  }),
});
