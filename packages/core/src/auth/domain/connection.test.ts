import { describe, expect, it } from 'vitest';
import { type ConnectionId, type UserId } from '@repo/contracts';
import {
  type AuthorizationCodeHash,
  type IssuedAuthorizationCode,
} from './authorization';
import {
  ACCESS_TOKEN_SECONDS,
  CONNECTION_IDLE_DAYS,
  REFRESH_TOKEN_DAYS,
  accessGrantOf,
  accessTokenExpiry,
  accessTokenLive,
  connectionFrom,
  connectionLapsed,
  lapseCutoff,
  redirectHostsOf,
  issuedTokensOf,
  refreshDecision,
  refreshTokenExpiry,
  type AccessTokenHash,
  type RefreshTokenHash,
  type StoredAccessToken,
  type StoredRefreshToken,
} from './connection';

const ISSUED_AT = new Date('2026-11-07T00:00:00.000Z');
const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;
const CONNECTION_ID = '01920000-0000-7000-8000-0000000000c1' as ConnectionId;

const later = (milliseconds: number): Date => new Date(ISSUED_AT.getTime() + milliseconds);

const DAY_MS = 24 * 60 * 60 * 1000;

describe('accessTokenExpiry', () => {
  it('is one hour after the Access token is issued', () => {
    expect(ACCESS_TOKEN_SECONDS).toBe(3600);
    expect(accessTokenExpiry(ISSUED_AT)).toEqual(new Date('2026-11-07T01:00:00.000Z'));
  });
});

describe('refreshTokenExpiry', () => {
  it('is 30 days after the refresh token is issued', () => {
    expect(REFRESH_TOKEN_DAYS).toBe(30);
    expect(refreshTokenExpiry(ISSUED_AT)).toEqual(new Date('2026-12-07T00:00:00.000Z'));
  });
});

describe('lapseCutoff', () => {
  it('is 30 days before now', () => {
    expect(CONNECTION_IDLE_DAYS).toBe(30);
    expect(lapseCutoff(new Date('2026-12-07T00:00:00.000Z'))).toEqual(ISSUED_AT);
  });
});

describe('connectionLapsed', () => {
  it('keeps a Connection used within the last 30 days', () => {
    expect(connectionLapsed(ISSUED_AT, ISSUED_AT)).toBe(false);
    expect(connectionLapsed(ISSUED_AT, later(CONNECTION_IDLE_DAYS * DAY_MS - 1))).toBe(false);
  });

  it('lapses a Connection 30 days after its last use, and from then on', () => {
    expect(connectionLapsed(ISSUED_AT, later(CONNECTION_IDLE_DAYS * DAY_MS))).toBe(true);
    expect(connectionLapsed(ISSUED_AT, later(CONNECTION_IDLE_DAYS * DAY_MS + 1))).toBe(true);
  });
});

describe('redirectHostsOf', () => {
  it('names each host the client may be sent back to once, in the order its redirects list them', () => {
    expect(
      redirectHostsOf([
        'https://client.example/callback',
        'http://127.0.0.1:8123/callback',
        'https://client.example/other',
      ]),
    ).toEqual(['client.example', '127.0.0.1:8123']);
  });
});

describe('accessTokenLive', () => {
  const token = { expiresAt: accessTokenExpiry(ISSUED_AT), lastUsedAt: ISSUED_AT };

  it('is live from its issue until just before its hour is up', () => {
    expect(accessTokenLive(token, ISSUED_AT)).toBe(true);
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000 - 1))).toBe(true);
  });

  it('is refused one hour after it was issued, and from then on', () => {
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000))).toBe(false);
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000 + 1))).toBe(false);
  });

  it('is refused once its Connection has lapsed, however long it would otherwise live', () => {
    const lasting = { expiresAt: later(365 * DAY_MS), lastUsedAt: ISSUED_AT };

    expect(accessTokenLive(lasting, later(CONNECTION_IDLE_DAYS * DAY_MS - 1))).toBe(true);
    expect(accessTokenLive(lasting, later(CONNECTION_IDLE_DAYS * DAY_MS))).toBe(false);
  });
});

describe('accessGrantOf', () => {
  it('reaches its Connection\'s User with its Connection\'s scopes alone, on behalf of its Connection', () => {
    const stored: StoredAccessToken = {
      connectionId: CONNECTION_ID,
      userId: USER_ID,
      clientId: 'https://client.example/client.json',
      scopes: ['read'],
      expiresAt: accessTokenExpiry(ISSUED_AT),
      lastUsedAt: ISSUED_AT,
    };

    expect(accessGrantOf(stored)).toEqual({
      auth: { userId: USER_ID, scopes: ['read'], connectionId: CONNECTION_ID },
      clientId: 'https://client.example/client.json',
      expiresAt: accessTokenExpiry(ISSUED_AT),
    });
  });
});

describe('connectionFrom', () => {
  it('keeps the client, its redirects and the granted scopes for the User who consented, created and last used now', () => {
    const code: IssuedAuthorizationCode = {
      codeHash: 'hash' as AuthorizationCodeHash,
      userId: USER_ID,
      clientId: 'https://client.example/client.json',
      clientName: 'Example client',
      redirectUris: ['https://client.example/callback'],
      scopes: ['write'],
      codeChallenge: 'challenge',
      redirectUri: 'https://client.example/callback',
      resource: 'https://books.example/mcp',
      expiresAt: later(60_000),
    };

    expect(connectionFrom(code, CONNECTION_ID, ISSUED_AT)).toEqual({
      id: CONNECTION_ID,
      userId: USER_ID,
      clientId: 'https://client.example/client.json',
      clientName: 'Example client',
      redirectUris: ['https://client.example/callback'],
      scopes: ['write'],
      createdAt: ISSUED_AT,
      lastUsedAt: ISSUED_AT,
    });
  });
});

describe('refreshDecision', () => {
  const REFRESH_HASH = 'hash:refresh' as RefreshTokenHash;
  const SUCCESSOR_HASH = 'hash:successor' as RefreshTokenHash;
  const CLIENT_ID = 'https://client.example/client.json';
  const stored = (changes: Partial<StoredRefreshToken> = {}): StoredRefreshToken => ({
    tokenHash: REFRESH_HASH,
    connectionId: CONNECTION_ID,
    clientId: CLIENT_ID,
    scopes: ['read', 'write'],
    expiresAt: refreshTokenExpiry(ISSUED_AT),
    discarded: false,
    successor: undefined,
    lastUsedAt: ISSUED_AT,
    ...changes,
  });
  const presented = { clientId: CLIENT_ID };
  const lastMoment = later(REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 - 1);

  it('rotates a refresh token never rotated before, discarding nothing', () => {
    expect(refreshDecision(stored(), presented, ISSUED_AT)).toEqual({
      kind: 'rotate',
      connectionId: CONNECTION_ID,
      scopes: ['read', 'write'],
      replaced: REFRESH_HASH,
      discards: undefined,
    });
  });

  it('rotates a replaced refresh token again while its successor is unused, discarding that successor', () => {
    const replaced = stored({ successor: { tokenHash: SUCCESSOR_HASH, used: false } });

    expect(refreshDecision(replaced, presented, lastMoment)).toEqual({
      kind: 'rotate',
      connectionId: CONNECTION_ID,
      scopes: ['read', 'write'],
      replaced: REFRESH_HASH,
      discards: SUCCESSOR_HASH,
    });
  });

  it('revokes the Connection of a replaced refresh token presented after its successor was used', () => {
    expect(refreshDecision(stored({ successor: { tokenHash: SUCCESSOR_HASH, used: true } }), presented, ISSUED_AT)).toEqual({
      kind: 'revoke',
      connectionId: CONNECTION_ID,
    });
  });

  it('revokes the Connection of a successor discarded by a grace use of the token it replaced', () => {
    expect(refreshDecision(stored({ discarded: true }), presented, ISSUED_AT)).toEqual({
      kind: 'revoke',
      connectionId: CONNECTION_ID,
    });
  });

  it('refuses an expired discarded successor, or one presented by another client, without revoking', () => {
    const discarded = stored({ discarded: true });

    expect(refreshDecision({ ...discarded, expiresAt: ISSUED_AT }, presented, ISSUED_AT)).toEqual({
      kind: 'refuse',
    });
    expect(
      refreshDecision(discarded, { clientId: 'https://other.example/client.json' }, ISSUED_AT),
    ).toEqual({ kind: 'refuse' });
  });

  it('refuses a refresh token it never issued, or whose Connection was revoked', () => {
    expect(refreshDecision(undefined, presented, ISSUED_AT)).toEqual({ kind: 'refuse' });
  });

  it('refuses a refresh token 30 days after it was issued, and from then on', () => {
    const thirtyDays = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

    expect(refreshDecision(stored(), presented, lastMoment)).toMatchObject({ kind: 'rotate' });
    expect(refreshDecision(stored(), presented, later(thirtyDays))).toEqual({ kind: 'refuse' });
    expect(refreshDecision(stored(), presented, later(thirtyDays + 1))).toEqual({ kind: 'refuse' });
  });

  it('refuses a refresh token, even a replayed one, once its Connection has lapsed', () => {
    const lasting = stored({ expiresAt: later(365 * DAY_MS) });
    const replayed = stored({
      expiresAt: later(365 * DAY_MS),
      successor: { tokenHash: SUCCESSOR_HASH, used: true },
    });
    const lapsedAt = later(CONNECTION_IDLE_DAYS * DAY_MS);

    expect(refreshDecision(lasting, presented, later(CONNECTION_IDLE_DAYS * DAY_MS - 1))).toMatchObject({
      kind: 'rotate',
    });
    expect(refreshDecision(lasting, presented, lapsedAt)).toEqual({ kind: 'refuse' });
    expect(refreshDecision(replayed, presented, lapsedAt)).toEqual({ kind: 'refuse' });
  });

  it('refuses an expired replaced refresh token without revoking its Connection', () => {
    const expired = stored({ successor: { tokenHash: SUCCESSOR_HASH, used: true }, expiresAt: ISSUED_AT });

    expect(refreshDecision(expired, presented, ISSUED_AT)).toEqual({ kind: 'refuse' });
  });

  it('refuses a refresh token presented by another client, without revoking its Connection', () => {
    const other = { clientId: 'https://other.example/client.json' };

    expect(refreshDecision(stored(), other, ISSUED_AT)).toEqual({ kind: 'refuse' });
    expect(refreshDecision(stored({ successor: { tokenHash: SUCCESSOR_HASH, used: true } }), other, ISSUED_AT)).toEqual({
      kind: 'refuse',
    });
  });
});

describe('issuedTokensOf', () => {
  it('lets the Access token live one hour and the refresh token 30 days from their issue', () => {
    expect(
      issuedTokensOf(
        { accessTokenHash: 'hash:access' as AccessTokenHash, refreshTokenHash: 'hash:refresh' as RefreshTokenHash },
        ISSUED_AT,
      ),
    ).toEqual({
      accessTokenHash: 'hash:access',
      accessTokenExpiresAt: new Date('2026-11-07T01:00:00.000Z'),
      refreshTokenHash: 'hash:refresh',
      refreshTokenExpiresAt: new Date('2026-12-07T00:00:00.000Z'),
    });
  });
});
