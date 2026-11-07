import { describe, expect, it } from 'vitest';
import {
  authorizationInputSchema,
  authorizationOutcomeSchema,
  authorizationRedirectSchema,
  beganSignInSchema,
  clientDocumentSchema,
  finishGoogleSignInInputSchema,
  issuedSessionSchema,
  pendingSignInSchema,
  testSignInInputSchema,
  toAuthorizationOutcome,
  toBeganSignIn,
  toIssuedSession,
  userIdSchema,
  type UserId,
} from './auth';

const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;

describe('userIdSchema', () => {
  it('accepts a uuid v7', () => {
    expect(userIdSchema.parse(USER_ID)).toBe(USER_ID);
  });

  it('rejects a uuid v4, which does not sort by creation time', () => {
    expect(userIdSchema.safeParse('9b2f6d1e-3c4a-4f5b-8a6d-7e8f9a0b1c2d').success).toBe(false);
  });
});

describe('toIssuedSession', () => {
  it("carries the token, the expiry as an ISO string the schema accepts, and the User's Language", () => {
    const issued = toIssuedSession({
      token: 'token',
      expiresAt: new Date('2026-10-18T09:30:00.123+09:00'),
      language: 'ko',
    });

    expect(issued).toStrictEqual({
      token: 'token',
      expiresAt: '2026-10-18T00:30:00.123Z',
      language: 'ko',
    });
    expect(issuedSessionSchema.parse(issued)).toEqual(issued);
  });
});

describe('toBeganSignIn', () => {
  it('carries the URL as a string, and only the pending fields', () => {
    const pending = { state: 'state', codeVerifier: 'verifier', extra: 'dropped' };

    const began = toBeganSignIn({
      authorizationUrl: { href: 'https://accounts.google.com/o/oauth2/v2/auth?state=state' },
      pending,
    });

    expect(began).toStrictEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state',
      pending: { state: 'state', codeVerifier: 'verifier' },
    });
    expect(beganSignInSchema.parse(began)).toEqual(began);
  });
});

describe('pendingSignInSchema', () => {
  it('accepts a state and a verifier', () => {
    expect(pendingSignInSchema.safeParse({ state: 's', codeVerifier: 'v' }).success).toBe(true);
  });

  it.each([
    ['an empty state', { state: '', codeVerifier: 'v' }],
    ['an empty verifier', { state: 's', codeVerifier: '' }],
    ['no verifier', { state: 's' }],
  ])('refuses %s', (_case, value) => {
    expect(pendingSignInSchema.safeParse(value).success).toBe(false);
  });
});

describe('issuedSessionSchema', () => {
  it('refuses an empty token', () => {
    expect(
      issuedSessionSchema.safeParse({
        token: '',
        expiresAt: '2026-10-18T00:30:00.000Z',
        language: 'en',
      }).success,
    ).toBe(false);
  });

  it.each([
    ['no Language', undefined],
    ['a Language the app does not have', 'fr'],
  ])('refuses %s', (_case, language) => {
    expect(
      issuedSessionSchema.safeParse({ token: 't', expiresAt: '2026-10-18T00:30:00.000Z', language })
        .success,
    ).toBe(false);
  });
});

describe('finishGoogleSignInInputSchema', () => {
  const CALLBACK = 'https://app.test/auth/callback/google?state=s&code=c';

  it('takes the callback URL, the Language, and the pending sign-in when there is one', () => {
    const pending = { state: 's', codeVerifier: 'v' };

    expect(
      finishGoogleSignInInputSchema.parse({ callbackUrl: CALLBACK, pending, language: 'ja' }),
    ).toEqual({ callbackUrl: CALLBACK, pending, language: 'ja' });
    expect(finishGoogleSignInInputSchema.parse({ callbackUrl: CALLBACK, language: 'en' })).toEqual({
      callbackUrl: CALLBACK,
      language: 'en',
    });
  });

  it('refuses a callback that is not a URL', () => {
    expect(
      finishGoogleSignInInputSchema.safeParse({ callbackUrl: 'callback', language: 'en' }).success,
    ).toBe(false);
  });

  it.each([undefined, 'fr'])('refuses %j as the Language', (language) => {
    expect(finishGoogleSignInInputSchema.safeParse({ callbackUrl: CALLBACK, language }).success).toBe(
      false,
    );
  });
});

describe('testSignInInputSchema', () => {
  it('takes the identifier as it was typed, and the Language', () => {
    expect(testSignInInputSchema.parse({ identifier: ' e2e-1 ', language: 'ko' })).toEqual({
      identifier: ' e2e-1 ',
      language: 'ko',
    });
  });

  it('takes the day the Accounts start on as it was typed, for the use case to judge', () => {
    expect(
      testSignInInputSchema.parse({ identifier: 'e2e-1', language: 'en', accountsStartOn: 'soon' }),
    ).toEqual({ identifier: 'e2e-1', language: 'en', accountsStartOn: 'soon' });
  });

  it('refuses no identifier', () => {
    expect(testSignInInputSchema.safeParse({ language: 'en' }).success).toBe(false);
  });

  it.each([undefined, 'fr'])('refuses %j as the Language', (language) => {
    expect(testSignInInputSchema.safeParse({ identifier: 'e2e-1', language }).success).toBe(false);
  });
});

describe('toAuthorizationOutcome', () => {
  it('carries what the consent page shows, and nothing the client could use', () => {
    const outcome = toAuthorizationOutcome({
      kind: 'consent',
      request: {
        clientName: 'Claude',
        redirectHost: 'claude.ai',
        scopes: ['read', 'write'],
      },
    });

    expect(outcome).toStrictEqual({
      outcome: 'consent',
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      scopes: ['read', 'write'],
    });
    expect(authorizationOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it('carries the location of a redirect', () => {
    const outcome = toAuthorizationOutcome({
      kind: 'redirect',
      to: { href: 'https://claude.ai/callback?error=invalid_target' },
    });

    expect(outcome).toStrictEqual({
      outcome: 'redirect',
      location: 'https://claude.ai/callback?error=invalid_target',
    });
    expect(authorizationOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it('carries nothing of a request that cannot be trusted', () => {
    const outcome = toAuthorizationOutcome({ kind: 'untrusted' });

    expect(outcome).toStrictEqual({ outcome: 'untrusted' });
    expect(authorizationOutcomeSchema.parse(outcome)).toEqual(outcome);
  });
});

describe('authorizationOutcomeSchema', () => {
  const consent = {
    outcome: 'consent',
    clientName: 'Claude',
    redirectHost: 'claude.ai',
    scopes: ['read'],
  };

  it('refuses a consent with no client name, no redirect host or no scope', () => {
    expect(authorizationOutcomeSchema.safeParse({ ...consent, clientName: '' }).success).toBe(false);
    expect(authorizationOutcomeSchema.safeParse({ ...consent, redirectHost: '' }).success).toBe(false);
    expect(authorizationOutcomeSchema.safeParse({ ...consent, scopes: [] }).success).toBe(false);
  });

  it('refuses a scope it does not know', () => {
    expect(authorizationOutcomeSchema.safeParse({ ...consent, scopes: ['admin'] }).success).toBe(
      false,
    );
  });

  it('refuses a redirect to something that is not a URL', () => {
    expect(
      authorizationOutcomeSchema.safeParse({ outcome: 'redirect', location: 'nowhere' }).success,
    ).toBe(false);
  });
});

describe('authorizationInputSchema', () => {
  it('takes the query as it is and the origin the request reached', () => {
    const input = { query: 'client_id=x', origin: 'https://books.example' };

    expect(authorizationInputSchema.parse(input)).toEqual(input);
  });

  it('refuses an origin that is not a URL', () => {
    expect(authorizationInputSchema.safeParse({ query: '', origin: 'books' }).success).toBe(false);
  });
});

describe('authorizationRedirectSchema', () => {
  it('carries the location the browser is sent to', () => {
    expect(authorizationRedirectSchema.safeParse({}).success).toBe(false);
    expect(authorizationRedirectSchema.parse({ location: 'https://claude.ai/callback' })).toEqual({
      location: 'https://claude.ai/callback',
    });
  });
});

describe('clientDocumentSchema', () => {
  const document = {
    client_id: 'https://claude.ai/oauth/client.json',
    client_name: 'Claude',
    redirect_uris: ['https://claude.ai/callback', 'http://127.0.0.1/callback'],
  };

  it('accepts a document listing several redirects', () => {
    expect(clientDocumentSchema.parse(document)).toEqual(document);
  });

  it('accepts a document stating no name', () => {
    expect(clientDocumentSchema.safeParse({ ...document, client_name: undefined }).success).toBe(
      true,
    );
  });

  it('refuses an empty name and a document listing no redirect', () => {
    expect(clientDocumentSchema.safeParse({ ...document, client_name: '' }).success).toBe(false);
    expect(clientDocumentSchema.safeParse({ ...document, redirect_uris: [] }).success).toBe(false);
  });
});
