import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import {
  type AuthorizationCodeHash,
  type CodeExchange,
  type IssuedAuthorizationCode,
} from '../domain/authorization';
import {
  type AccessToken,
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type RefreshToken,
  type RefreshTokenHash,
} from '../domain/connection';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { type ConnectionRepository } from '../ports/connection-repository';
import { createExchangeCode } from './exchange-code';

const NOW = new Date('2026-11-07T00:00:30.000Z');
const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;
const CONNECTION_ID = '01920000-0000-7000-8000-0000000000c1' as ConnectionId;
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const CODE: IssuedAuthorizationCode = {
  codeHash: 'hash:the-code' as AuthorizationCodeHash,
  userId: USER_ID,
  clientId: 'https://client.example/client.json',
  clientName: 'Example client',
  redirectUris: ['https://client.example/callback'],
  scopes: ['read'],
  codeChallenge: 'challenge:the-verifier',
  redirectUri: 'https://client.example/callback',
  resource: 'https://books.example/mcp',
  expiresAt: new Date('2026-11-07T00:01:00.000Z'),
};

const EXCHANGE: CodeExchange = {
  code: 'the-code',
  codeVerifier: 'the-verifier',
  redirectUri: 'https://client.example/callback',
  clientId: 'https://client.example/client.json',
  resource: 'https://books.example/mcp',
};

function codeStore(
  stored: readonly IssuedAuthorizationCode[] = [CODE],
  failure?: DomainError,
): AuthorizationCodeRepository & { readonly codes: IssuedAuthorizationCode[] } {
  const codes = [...stored];
  return {
    codes,
    add: () => Promise.resolve(ok(undefined)),
    take: (codeHash) => {
      if (failure !== undefined) {
        return Promise.resolve(err(failure));
      }
      const index = codes.findIndex((code) => code.codeHash === codeHash);
      const [taken] = index === -1 ? [] : codes.splice(index, 1);
      return Promise.resolve(ok(taken));
    },
  };
}

type Opened = { readonly connection: Connection; readonly tokens: IssuedTokens };

function connectionStore(
  answer: Result<void, DomainError> = ok(undefined),
): ConnectionRepository & { readonly opened: Opened[] } {
  const opened: Opened[] = [];
  return {
    opened,
    open: (connection, tokens) => {
      if (answer.ok) {
        opened.push({ connection, tokens });
      }
      return Promise.resolve(answer);
    },
    findAccessToken: () => Promise.resolve(ok(undefined)),
    findRefreshToken: () => Promise.resolve(ok(undefined)),
    rotate: () => Promise.resolve(ok(false)),
    revoke: () => Promise.resolve(ok(undefined)),
  };
}

function exchanging(
  codes = codeStore(),
  connections = connectionStore(),
) {
  let issued = 0;
  return createExchangeCode({
    codes,
    connections,
    hashAuthorizationCode: (code) => `hash:${code}` as AuthorizationCodeHash,
    pkceChallengeOf: (verifier) => `challenge:${verifier}`,
    newConnectionId: () => CONNECTION_ID,
    newAccessToken: () => `access-${String((issued += 1))}` as AccessToken,
    hashAccessToken: (token) => `hash:${token}` as AccessTokenHash,
    newRefreshToken: () => `refresh-${String((issued += 1))}` as RefreshToken,
    hashRefreshToken: (token) => `hash:${token}` as RefreshTokenHash,
    now: () => NOW,
  });
}

describe('createExchangeCode', () => {
  it('answers an hour-long Access token, a refresh token and the granted scopes', async () => {
    const result = await exchanging()(EXCHANGE);

    expect(result).toEqual(
      ok({
        kind: 'granted',
        tokens: { accessToken: 'access-1', refreshToken: 'refresh-2', expiresIn: 3600, scopes: ['read'] },
      }),
    );
  });

  it('opens a Connection for the User who consented, storing only the hashes of its tokens', async () => {
    const connections = connectionStore();

    await exchanging(codeStore(), connections)(EXCHANGE);

    expect(connections.opened).toEqual([
      {
        connection: {
          id: CONNECTION_ID,
          userId: USER_ID,
          clientId: CODE.clientId,
          clientName: 'Example client',
          redirectUris: CODE.redirectUris,
          scopes: ['read'],
          createdAt: NOW,
          lastUsedAt: NOW,
        },
        tokens: {
          accessTokenHash: 'hash:access-1',
          accessTokenExpiresAt: new Date('2026-11-07T01:00:30.000Z'),
          refreshTokenHash: 'hash:refresh-2',
          refreshTokenExpiresAt: new Date('2026-12-07T00:00:30.000Z'),
        },
      },
    ]);
  });

  it('works once: the second exchange of the same code is refused and opens nothing', async () => {
    const connections = connectionStore();
    const exchange = exchanging(codeStore(), connections);
    await exchange(EXCHANGE);

    const again = await exchange(EXCHANGE);

    expect(again).toEqual(ok({ kind: 'refused' }));
    expect(connections.opened).toHaveLength(1);
  });

  it('refuses a code it never issued', async () => {
    const connections = connectionStore();

    const result = await exchanging(codeStore([]), connections)(EXCHANGE);

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.opened).toEqual([]);
  });

  it.each([
    ['another verifier', { codeVerifier: 'another-verifier' }],
    ['another redirect', { redirectUri: 'https://client.example/elsewhere' }],
    ['another client', { clientId: 'https://other.example/client.json' }],
    ['another resource', { resource: 'https://other.example/mcp' }],
  ])('refuses a code presented with %s, and spends it', async (_, change) => {
    const codes = codeStore();
    const connections = connectionStore();
    const exchange = exchanging(codes, connections);

    const result = await exchange({ ...EXCHANGE, ...change });

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.opened).toEqual([]);
    expect(codes.codes).toEqual([]);
  });

  it('refuses a code whose 60 seconds have passed', async () => {
    const result = await exchanging(codeStore([{ ...CODE, expiresAt: NOW }]))(EXCHANGE);

    expect(result).toEqual(ok({ kind: 'refused' }));
  });

  it('passes on a failure to read the code', async () => {
    const result = await exchanging(codeStore([CODE], UNAVAILABLE))(EXCHANGE);

    expect(result).toEqual(err(UNAVAILABLE));
  });

  it('passes on a failure to open the Connection', async () => {
    const result = await exchanging(codeStore(), connectionStore(err(UNAVAILABLE)))(
      EXCHANGE,
    );

    expect(result).toEqual(err(UNAVAILABLE));
  });
});
