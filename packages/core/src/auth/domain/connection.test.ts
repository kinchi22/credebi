import { describe, expect, it } from 'vitest';
import { type ConnectionId, type UserId } from '@repo/contracts';
import {
  type AuthorizationCodeHash,
  type IssuedAuthorizationCode,
} from './authorization';
import {
  ACCESS_TOKEN_SECONDS,
  REFRESH_TOKEN_DAYS,
  accessGrantOf,
  accessTokenExpiry,
  accessTokenLive,
  connectionFrom,
  refreshTokenExpiry,
  type StoredAccessToken,
} from './connection';

const ISSUED_AT = new Date('2026-11-07T00:00:00.000Z');
const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;
const CONNECTION_ID = '01920000-0000-7000-8000-0000000000c1' as ConnectionId;

const later = (milliseconds: number): Date => new Date(ISSUED_AT.getTime() + milliseconds);

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

describe('accessTokenLive', () => {
  const token = { expiresAt: accessTokenExpiry(ISSUED_AT) };

  it('is live from its issue until just before its hour is up', () => {
    expect(accessTokenLive(token, ISSUED_AT)).toBe(true);
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000 - 1))).toBe(true);
  });

  it('is refused one hour after it was issued, and from then on', () => {
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000))).toBe(false);
    expect(accessTokenLive(token, later(ACCESS_TOKEN_SECONDS * 1000 + 1))).toBe(false);
  });
});

describe('accessGrantOf', () => {
  it('reaches its Connection\'s User with its Connection\'s scopes alone', () => {
    const stored: StoredAccessToken = {
      connectionId: CONNECTION_ID,
      userId: USER_ID,
      clientId: 'https://client.example/client.json',
      scopes: ['read'],
      expiresAt: accessTokenExpiry(ISSUED_AT),
    };

    expect(accessGrantOf(stored)).toEqual({
      auth: { userId: USER_ID, scopes: ['read'] },
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
