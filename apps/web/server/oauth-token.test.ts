import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';
import {
  type AccessToken,
  type CodeExchange,
  type CodeExchangeOutcome,
  type GrantedTokens,
  type RefreshGrant,
  type RefreshOutcome,
  type RefreshToken,
} from '@repo/core';
import { describe, expect, it } from 'vitest';
import { serveToken } from './oauth-token';

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const FORM: Readonly<Record<string, string>> = {
  grant_type: 'authorization_code',
  code: 'the-code',
  code_verifier: VERIFIER,
  redirect_uri: 'https://client.example/callback',
  client_id: 'https://client.example/client.json',
  resource: 'https://books.example/mcp',
};

const GRANTED: GrantedTokens = {
  accessToken: 'the-access-token' as AccessToken,
  refreshToken: 'the-refresh-token' as RefreshToken,
  expiresIn: 3600,
  scopes: ['read', 'write'],
};

const REFRESHED: GrantedTokens = {
  accessToken: 'the-next-access-token' as AccessToken,
  refreshToken: 'the-next-refresh-token' as RefreshToken,
  expiresIn: 3600,
  scopes: ['read'],
};

function exchanging(
  answer: Result<CodeExchangeOutcome, DomainError> = ok({ kind: 'granted', tokens: GRANTED }),
  refreshAnswer: Result<RefreshOutcome, DomainError> = ok({ kind: 'granted', tokens: REFRESHED }),
) {
  const exchanges: CodeExchange[] = [];
  const refreshes: RefreshGrant[] = [];
  const serve = serveToken(() => ({
    exchangeCode: (exchange) => {
      exchanges.push(exchange);
      return Promise.resolve(answer);
    },
    refreshAccessToken: (grant) => {
      refreshes.push(grant);
      return Promise.resolve(refreshAnswer);
    },
  }));
  return { serve, exchanges, refreshes };
}

const REFRESH_FORM: Readonly<Record<string, string>> = {
  grant_type: 'refresh_token',
  refresh_token: 'the-refresh-token',
  client_id: 'https://client.example/client.json',
};

const refreshForm = (changes: Readonly<Record<string, string | null>> = {}): string => {
  const search = new URLSearchParams(REFRESH_FORM);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) {
      search.delete(name);
    } else {
      search.set(name, value);
    }
  }
  return search.toString();
};

const post = (
  body: string,
  contentType = 'application/x-www-form-urlencoded',
): Request =>
  new Request('https://books.example/oauth/token', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });

const form = (changes: Readonly<Record<string, string | null>> = {}): string => {
  const search = new URLSearchParams(FORM);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) {
      search.delete(name);
    } else {
      search.set(name, value);
    }
  }
  return search.toString();
};

async function expectOAuthError(response: Response, error: string, status = 400): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = (await response.json()) as Record<string, unknown>;
  expect(body['error']).toBe(error);
  expect(body['error_description']).toMatch(/\S/);
  expect(body['access_token']).toBeUndefined();
}

describe('serveToken', () => {
  it('exchanges an authorization code for a Bearer Access token, its lifetime, a refresh token and the scopes', async () => {
    const { serve, exchanges } = exchanging();

    const response = await serve(post(form()));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      access_token: 'the-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'the-refresh-token',
      scope: 'read write',
    });
    expect(exchanges).toEqual([
      {
        code: 'the-code',
        codeVerifier: VERIFIER,
        redirectUri: 'https://client.example/callback',
        clientId: 'https://client.example/client.json',
        resource: 'https://books.example/mcp',
      },
    ]);
  });

  it('takes a form whose content type names a charset', async () => {
    const response = await exchanging().serve(
      post(form(), 'Application/X-WWW-Form-Urlencoded; charset=UTF-8'),
    );

    expect(response.status).toBe(200);
  });

  it('answers invalid_grant to a code the exchange refuses', async () => {
    await expectOAuthError(
      await exchanging(ok({ kind: 'refused' })).serve(post(form())),
      'invalid_grant',
    );
  });

  it.each([
    ['a failure of the exchange itself', 'DEPENDENCY_UNAVAILABLE'],
    ['an invalid input the exchange reports', 'INVALID_INPUT'],
  ] as const)('answers server_error to %s, never invalid_grant', async (_, code) => {
    await expectOAuthError(
      await exchanging(err(domainError(code, 'It went wrong.'))).serve(post(form())),
      'server_error',
      500,
    );
  });

  it.each([
    ['a body that is not a form', post(JSON.stringify(FORM), 'application/json')],
    ['no content type', new Request('https://books.example/oauth/token', { method: 'POST', body: form() })],
    ['no grant_type', post(form({ grant_type: null }))],
    ['no PKCE verifier', post(form({ code_verifier: null }))],
    ['no code', post(form({ code: null }))],
    ['no resource', post(form({ resource: null }))],
    ['a parameter given twice', post(`${form()}&code=another-code`)],
  ])('answers invalid_request to %s, exchanging nothing', async (_, request) => {
    const { serve, exchanges } = exchanging();

    await expectOAuthError(await serve(request), 'invalid_request');
    expect(exchanges).toEqual([]);
  });

  it('answers unsupported_grant_type to a grant it does not take', async () => {
    const { serve, exchanges } = exchanging();

    await expectOAuthError(
      await serve(post(form({ grant_type: 'client_credentials' }))),
      'unsupported_grant_type',
    );
    expect(exchanges).toEqual([]);
  });
});

describe('serveToken refreshing', () => {
  it('refreshes for a new Bearer Access token, its lifetime, a new refresh token and the scopes', async () => {
    const { serve, exchanges, refreshes } = exchanging();

    const response = await serve(post(refreshForm({ resource: 'https://books.example/mcp' })));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      access_token: 'the-next-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'the-next-refresh-token',
      scope: 'read',
    });
    expect(refreshes).toEqual([
      { refreshToken: 'the-refresh-token', clientId: 'https://client.example/client.json' },
    ]);
    expect(exchanges).toEqual([]);
  });

  it('answers invalid_grant to a refresh token the refresh refuses', async () => {
    await expectOAuthError(
      await exchanging(undefined, ok({ kind: 'refused' })).serve(post(refreshForm())),
      'invalid_grant',
    );
  });

  it('answers server_error to a failure of the refresh itself, never invalid_grant', async () => {
    await expectOAuthError(
      await exchanging(undefined, err(domainError('DEPENDENCY_UNAVAILABLE', 'It went wrong.'))).serve(
        post(refreshForm()),
      ),
      'server_error',
      500,
    );
  });

  it.each([
    ['no refresh token', post(refreshForm({ refresh_token: null }))],
    ['no client', post(refreshForm({ client_id: null }))],
    ['a refresh token given twice', post(`${refreshForm()}&refresh_token=another`)],
  ])('answers invalid_request to %s, refreshing nothing', async (_, request) => {
    const { serve, refreshes } = exchanging();

    await expectOAuthError(await serve(request), 'invalid_request');
    expect(refreshes).toEqual([]);
  });
});
