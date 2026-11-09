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
import { type AccessTokenHash, type StoredAccessToken } from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import { createResolveAccessToken } from './resolve-access-token';

const ISSUED_AT = new Date('2026-11-07T00:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;

const STORED: StoredAccessToken = {
  connectionId: '01920000-0000-7000-8000-0000000000c1' as ConnectionId,
  userId: USER_ID,
  clientId: 'https://client.example/client.json',
  scopes: ['read', 'write'],
  expiresAt: new Date(ISSUED_AT.getTime() + HOUR_MS),
  lastUsedAt: ISSUED_AT,
};

type Used = { readonly connectionId: ConnectionId; readonly at: Date };

function connections(
  answer: Result<StoredAccessToken | undefined, DomainError> = ok(STORED),
  marking: Result<void, DomainError> = ok(undefined),
  revoking: Result<void, DomainError> = ok(undefined),
): ConnectionRepository & {
  readonly looked: string[];
  readonly used: Used[];
  readonly revoked: ConnectionId[];
} {
  const looked: string[] = [];
  const used: Used[] = [];
  const revoked: ConnectionId[] = [];
  return {
    looked,
    used,
    revoked,
    open: () => Promise.resolve(ok(undefined)),
    findAccessToken: (tokenHash) => {
      looked.push(tokenHash);
      return Promise.resolve(answer);
    },
    findRefreshToken: () => Promise.resolve(ok(undefined)),
    rotate: () => Promise.resolve(ok('overtaken' as const)),
    markUsed: (connectionId, at) => {
      if (marking.ok) {
        used.push({ connectionId, at });
      }
      return Promise.resolve(marking);
    },
    listLive: () => Promise.resolve(ok([])),
    revoke: (connectionId) => {
      if (revoking.ok) {
        revoked.push(connectionId);
      }
      return Promise.resolve(revoking);
    },
    revokeOwnedBy: () => Promise.resolve(ok(undefined)),
  };
}

const resolving = (repository: ConnectionRepository, now: Date) =>
  createResolveAccessToken({
    connections: repository,
    hashAccessToken: (token) => `hash:${token}` as AccessTokenHash,
    now: () => now,
  });

describe('createResolveAccessToken', () => {
  it('resolves a live Access token, found by its hash, to its User, scopes and Connection', async () => {
    const repository = connections();

    const result = await resolving(repository, ISSUED_AT)('the-token');

    expect(result).toEqual(
      ok({
        auth: { userId: USER_ID, scopes: ['read', 'write'], connectionId: STORED.connectionId },
        clientId: 'https://client.example/client.json',
        expiresAt: STORED.expiresAt,
      }),
    );
    expect(repository.looked).toEqual(['hash:the-token']);
  });

  it('records the call as its Connection\'s last use', async () => {
    const repository = connections();
    const calledAt = new Date(ISSUED_AT.getTime() + HOUR_MS / 2);

    await resolving(repository, calledAt)('the-token');

    expect(repository.used).toEqual([{ connectionId: STORED.connectionId, at: calledAt }]);
  });

  it('records no use for a token it refuses', async () => {
    const expired = connections();
    const unknown = connections(ok(undefined));

    await resolving(expired, new Date(ISSUED_AT.getTime() + HOUR_MS))('the-token');
    await resolving(unknown, ISSUED_AT)('unknown');

    expect(expired.used).toEqual([]);
    expect(unknown.used).toEqual([]);
  });

  it('refuses an Access token whose Connection has lapsed, and deletes that Connection', async () => {
    const lapsedToken = ok({ ...STORED, lastUsedAt: new Date(ISSUED_AT.getTime() - 30 * 24 * HOUR_MS) });
    const lapsed = connections(lapsedToken);

    expect(await resolving(lapsed, ISSUED_AT)('the-token')).toEqual(ok(undefined));
    expect(lapsed.used).toEqual([]);
    expect(lapsed.revoked).toEqual([STORED.connectionId]);
  });

  it('deletes no Connection for an Access token that has merely expired', async () => {
    const expired = connections();

    await resolving(expired, new Date(ISSUED_AT.getTime() + HOUR_MS))('the-token');

    expect(expired.revoked).toEqual([]);
  });

  it('passes on a failure to delete a lapsed Connection', async () => {
    const unavailable = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const lapsedToken = ok({ ...STORED, lastUsedAt: new Date(ISSUED_AT.getTime() - 30 * 24 * HOUR_MS) });

    expect(
      await resolving(connections(lapsedToken, ok(undefined), err(unavailable)), ISSUED_AT)('the-token'),
    ).toEqual(err(unavailable));
  });

  it('passes on a failure to record the use', async () => {
    const unavailable = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

    expect(
      await resolving(connections(ok(STORED), err(unavailable)), ISSUED_AT)('the-token'),
    ).toEqual(err(unavailable));
  });

  it('refuses an Access token one hour after it was issued', async () => {
    const justBefore = new Date(ISSUED_AT.getTime() + HOUR_MS - 1);
    const onTheHour = new Date(ISSUED_AT.getTime() + HOUR_MS);

    expect(await resolving(connections(), justBefore)('the-token')).toMatchObject({ ok: true, value: {} });
    expect(await resolving(connections(), onTheHour)('the-token')).toEqual(ok(undefined));
  });

  it('resolves a token it never issued to nothing', async () => {
    expect(await resolving(connections(ok(undefined)), ISSUED_AT)('unknown')).toEqual(ok(undefined));
  });

  it('passes on a failure to read the token', async () => {
    const unavailable = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

    expect(await resolving(connections(err(unavailable)), ISSUED_AT)('the-token')).toEqual(
      err(unavailable),
    );
  });
});
