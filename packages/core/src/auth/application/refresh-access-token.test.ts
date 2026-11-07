import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import {
  type AccessToken,
  type AccessTokenHash,
  type RefreshRotation,
  type RefreshToken,
  type RefreshTokenHash,
  type RotationOutcome,
  type StoredRefreshToken,
} from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import { createRefreshAccessToken } from './refresh-access-token';

const NOW = new Date('2026-11-07T00:00:30.000Z');
const CONNECTION_ID = '01920000-0000-7000-8000-0000000000c1' as ConnectionId;
const CLIENT_ID = 'https://client.example/client.json';
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const STORED: StoredRefreshToken = {
  tokenHash: 'hash:the-refresh-token' as RefreshTokenHash,
  connectionId: CONNECTION_ID,
  clientId: CLIENT_ID,
  scopes: ['read', 'write'],
  expiresAt: new Date('2026-12-01T00:00:00.000Z'),
  discarded: false,
  successor: undefined,
};

const REPLAYED: StoredRefreshToken = { ...STORED, successor: { tokenHash: 'hash:next' as RefreshTokenHash, used: true } };

const GRANT = { refreshToken: 'the-refresh-token', clientId: CLIENT_ID };

type Answers = {
  readonly find?: Result<StoredRefreshToken | undefined, DomainError>;
  readonly rotate?: Result<RotationOutcome, DomainError>;
  readonly revoke?: Result<void, DomainError>;
};

function connectionStore(
  answers: Answers = {},
): ConnectionRepository & {
  readonly looked: string[];
  readonly rotated: RefreshRotation[];
  readonly revoked: ConnectionId[];
} {
  const looked: string[] = [];
  const rotated: RefreshRotation[] = [];
  const revoked: ConnectionId[] = [];
  return {
    looked,
    rotated,
    revoked,
    open: () => Promise.resolve(ok(undefined)),
    findAccessToken: () => Promise.resolve(ok(undefined)),
    findRefreshToken: (tokenHash) => {
      looked.push(tokenHash);
      const answer = answers.find ?? ok(tokenHash === STORED.tokenHash ? STORED : undefined);
      return Promise.resolve(answer);
    },
    rotate: (rotation) => {
      const answer = answers.rotate ?? ok<RotationOutcome>('rotated');
      if (answer.ok && answer.value === 'rotated') {
        rotated.push(rotation);
      }
      return Promise.resolve(answer);
    },
    revoke: (connectionId) => {
      const answer = answers.revoke ?? ok(undefined);
      if (answer.ok) {
        revoked.push(connectionId);
      }
      return Promise.resolve(answer);
    },
  };
}

function refreshing(connections = connectionStore()) {
  let issued = 0;
  return createRefreshAccessToken({
    connections,
    newAccessToken: () => `access-${String((issued += 1))}` as AccessToken,
    hashAccessToken: (token) => `hash:${token}` as AccessTokenHash,
    newRefreshToken: () => `refresh-${String((issued += 1))}` as RefreshToken,
    hashRefreshToken: (token) => `hash:${token}` as RefreshTokenHash,
    now: () => NOW,
  });
}

describe('createRefreshAccessToken', () => {
  it('answers a new hour-long Access token and a new refresh token for the Connection\'s scopes', async () => {
    const result = await refreshing()(GRANT);

    expect(result).toEqual(
      ok({
        kind: 'granted',
        tokens: {
          accessToken: 'access-1',
          refreshToken: 'refresh-2',
          expiresIn: 3600,
          scopes: ['read', 'write'],
        },
      }),
    );
  });

  it('looks the refresh token up by its hash, and stores only the hashes of the new tokens', async () => {
    const connections = connectionStore();

    await refreshing(connections)(GRANT);

    expect(connections.looked).toEqual(['hash:the-refresh-token']);
    expect(connections.rotated).toEqual([
      {
        connectionId: CONNECTION_ID,
        replaced: 'hash:the-refresh-token',
        discards: undefined,
        rotatedAt: NOW,
        tokens: {
          accessTokenHash: 'hash:access-1',
          accessTokenExpiresAt: new Date('2026-11-07T01:00:30.000Z'),
          refreshTokenHash: 'hash:refresh-2',
          refreshTokenExpiresAt: new Date('2026-12-07T00:00:30.000Z'),
        },
      },
    ]);
  });

  it('rotates a replaced refresh token again while its successor is unused, discarding that successor', async () => {
    const replaced: StoredRefreshToken = {
      ...STORED,
      successor: { tokenHash: 'hash:lost' as RefreshTokenHash, used: false },
    };
    const connections = connectionStore({ find: ok(replaced) });

    const result = await refreshing(connections)(GRANT);

    expect(result).toMatchObject(ok({ kind: 'granted' }));
    expect(connections.rotated.map((rotation) => rotation.discards)).toEqual(['hash:lost']);
  });

  it('revokes the Connection and refuses a replaced refresh token presented after its successor was used', async () => {
    const connections = connectionStore({ find: ok(REPLAYED) });

    const result = await refreshing(connections)(GRANT);

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.revoked).toEqual([CONNECTION_ID]);
    expect(connections.rotated).toEqual([]);
  });

  it('revokes the Connection and refuses a successor discarded by a grace use', async () => {
    const connections = connectionStore({ find: ok({ ...STORED, discarded: true }) });

    const result = await refreshing(connections)(GRANT);

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.revoked).toEqual([CONNECTION_ID]);
    expect(connections.rotated).toEqual([]);
  });

  it('refuses a refresh token it never issued, revoking nothing', async () => {
    const connections = connectionStore();

    const result = await refreshing(connections)({ ...GRANT, refreshToken: 'never-issued' });

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.rotated).toEqual([]);
    expect(connections.revoked).toEqual([]);
  });

  it('refuses an expired refresh token', async () => {
    const connections = connectionStore({ find: ok({ ...STORED, expiresAt: NOW }) });

    expect(await refreshing(connections)(GRANT)).toEqual(ok({ kind: 'refused' }));
    expect(connections.rotated).toEqual([]);
  });

  it('refuses a refresh token presented by another client', async () => {
    const connections = connectionStore();

    const result = await refreshing(connections)({ ...GRANT, clientId: 'https://other.example/c.json' });

    expect(result).toEqual(ok({ kind: 'refused' }));
    expect(connections.rotated).toEqual([]);
  });

  it('refuses a refresh that another refresh of the same token overtook', async () => {
    const result = await refreshing(connectionStore({ rotate: ok('overtaken') }))(GRANT);

    expect(result).toEqual(ok({ kind: 'refused' }));
  });

  it.each([
    ['read the refresh token', { find: err(UNAVAILABLE) }],
    ['rotate it', { rotate: err(UNAVAILABLE) }],
    ['revoke its Connection', { find: ok(REPLAYED), revoke: err(UNAVAILABLE) }],
  ] satisfies [string, Answers][])('passes on a failure to %s', async (_, answers) => {
    expect(await refreshing(connectionStore(answers))(GRANT)).toEqual(err(UNAVAILABLE));
  });
});
