import { z } from 'zod';
import { type Brand } from './brand';
import { uuidV7Schema } from './id';
import { languageSchema, type Language } from './settings';

export type UserId = Brand<string, 'UserId'>;
export const userIdSchema = uuidV7Schema.transform((id): UserId => id as UserId);

export const SCOPES = ['read', 'write'] as const;

export const scopeSchema = z.enum(SCOPES);

export type Scope = z.infer<typeof scopeSchema>;

export const authorizationInputSchema = z.object({
  query: z.string(),
  origin: z.url(),
});

export type AuthorizationInput = z.infer<typeof authorizationInputSchema>;

export const authorizationOutcomeSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('consent'),
    clientName: z.string().min(1),
    redirectHost: z.string().min(1),
    scopes: z.array(scopeSchema).min(1),
  }),
  z.object({ outcome: z.literal('redirect'), location: z.url() }),
  z.object({ outcome: z.literal('untrusted') }),
]);

export type AuthorizationOutcomeOutput = z.infer<typeof authorizationOutcomeSchema>;

export const authorizationRedirectSchema = z.object({ location: z.url() });

export const clientDocumentSchema = z.object({
  client_id: z.string(),
  client_name: z.string().min(1).optional(),
  redirect_uris: z.array(z.url()).min(1),
});

export const pendingSignInSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

export type PendingSignInInput = z.infer<typeof pendingSignInSchema>;

export const beganSignInSchema = z.object({
  authorizationUrl: z.url(),
  pending: pendingSignInSchema,
});

export type BeganSignIn = z.infer<typeof beganSignInSchema>;

export const finishGoogleSignInInputSchema = z.object({
  callbackUrl: z.url(),
  pending: pendingSignInSchema.optional(),
  language: languageSchema,
});

export const testSignInInputSchema = z.object({
  identifier: z.string(),
  language: languageSchema,
  accountsStartOn: z.string().optional(),
});

export const TEST_SIGN_IN_FIELDS = {
  identifier: 'identifier',
  accountsStartOn: 'accountsStartOn',
  returnTo: 'returnTo',
} as const;

export const issuedSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
  language: languageSchema,
});

export type IssuedSessionOutput = z.infer<typeof issuedSessionSchema>;

export function toIssuedSession(session: {
  readonly token: string;
  readonly expiresAt: Date;
  readonly language: Language;
}): IssuedSessionOutput {
  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    language: session.language,
  };
}

export function toBeganSignIn(began: {
  readonly authorizationUrl: { readonly href: string };
  readonly pending: PendingSignInInput;
}): BeganSignIn {
  return {
    authorizationUrl: began.authorizationUrl.href,
    pending: { state: began.pending.state, codeVerifier: began.pending.codeVerifier },
  };
}

export function toAuthorizationOutcome(
  outcome:
    | { readonly kind: 'untrusted' }
    | { readonly kind: 'redirect'; readonly to: { readonly href: string } }
    | {
        readonly kind: 'consent';
        readonly request: {
          readonly clientName: string;
          readonly redirectHost: string;
          readonly scopes: readonly Scope[];
        };
      },
): AuthorizationOutcomeOutput {
  switch (outcome.kind) {
    case 'untrusted':
      return { outcome: 'untrusted' };
    case 'redirect':
      return { outcome: 'redirect', location: outcome.to.href };
    case 'consent':
      return {
        outcome: 'consent',
        clientName: outcome.request.clientName,
        redirectHost: outcome.request.redirectHost,
        scopes: [...outcome.request.scopes],
      };
  }
}
