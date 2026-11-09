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
import { SIGNED_OUT } from '../domain/auth-context';
import { type Connection } from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import { createListConnections } from './list-connections';
import { createRevokeConnection } from './revoke-connection';

const NOW = new Date('2026-12-07T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;
const OTHER_USER_ID = '01920000-0000-7000-8000-000000000002' as UserId;
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const connection = (
  id: string,
  userId: UserId,
  lastUsedAt: Date,
): Connection => ({
  id: id as ConnectionId,
  userId,
  clientId: 'https://client.example/client.json',
  clientName: 'Example client',
  redirectUris: ['https://client.example/callback'],
  approvedRedirectUri: 'https://client.example/callback',
  scopes: ['read'],
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  lastUsedAt,
});

const RECENT = connection('01920000-0000-7000-8000-0000000000c1', USER_ID, new Date(NOW.getTime() - 29 * DAY_MS));
const LAPSED = connection('01920000-0000-7000-8000-0000000000c2', USER_ID, new Date(NOW.getTime() - 30 * DAY_MS));
const OTHERS = connection('01920000-0000-7000-8000-0000000000c3', OTHER_USER_ID, NOW);

type Failures = {
  readonly list?: DomainError;
  readonly revoke?: DomainError;
};

function store(failures: Failures = {}): ConnectionRepository & { stored: Connection[] } {
  const repository = {
    stored: [RECENT, LAPSED, OTHERS],
    open: () => Promise.resolve(ok(undefined)),
    findAccessToken: () => Promise.resolve(ok(undefined)),
    findRefreshToken: () => Promise.resolve(ok(undefined)),
    rotate: () => Promise.resolve(ok('overtaken' as const)),
    markUsed: () => Promise.resolve(ok(undefined)),
    listLive: (userId: UserId, usedAfter: Date): Promise<Result<readonly Connection[], DomainError>> =>
      Promise.resolve(
        failures.list === undefined
          ? ok(
              repository.stored.filter(
                (one) => one.userId === userId && one.lastUsedAt.getTime() > usedAfter.getTime(),
              ),
            )
          : err(failures.list),
      ),
    revoke: () => Promise.resolve(ok(undefined)),
    revokeOwnedBy: (userId: UserId, connectionId: ConnectionId): Promise<Result<void, DomainError>> => {
      if (failures.revoke !== undefined) {
        return Promise.resolve(err(failures.revoke));
      }
      repository.stored = repository.stored.filter(
        (one) => !(one.userId === userId && one.id === connectionId),
      );
      return Promise.resolve(ok(undefined));
    },
  };
  return repository;
}

const listing = (repository: ConnectionRepository) =>
  createListConnections({ connections: repository, now: () => NOW });

const revoking = (repository: ConnectionRepository) =>
  createRevokeConnection({ connections: repository });

describe('createListConnections', () => {
  it('lists the User\'s own Connections used within the last 30 days, leaving out the lapsed', async () => {
    expect(await listing(store())({ userId: USER_ID })).toEqual(ok([RECENT]));
  });

  it('lists nothing for a signed-out request', async () => {
    expect(await listing(store())(SIGNED_OUT)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('passes on a failure to read the Connections', async () => {
    expect(await listing(store({ list: UNAVAILABLE }))({ userId: USER_ID })).toEqual(err(UNAVAILABLE));
  });
});

describe('createRevokeConnection', () => {
  it('removes the User\'s Connection from their list', async () => {
    const repository = store();

    expect(await revoking(repository)({ userId: USER_ID }, RECENT.id)).toEqual(ok(undefined));

    expect(await listing(repository)({ userId: USER_ID })).toEqual(ok([]));
  });

  it('leaves another User\'s Connection alone', async () => {
    const repository = store();

    await revoking(repository)({ userId: USER_ID }, OTHERS.id);

    expect(await listing(repository)({ userId: OTHER_USER_ID })).toEqual(ok([OTHERS]));
  });

  it('revokes nothing for a signed-out request', async () => {
    const repository = store();

    expect(await revoking(repository)(SIGNED_OUT, RECENT.id)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(await listing(repository)({ userId: USER_ID })).toEqual(ok([RECENT]));
  });

  it('passes on a failure to revoke', async () => {
    expect(
      await revoking(store({ revoke: UNAVAILABLE }))({ userId: USER_ID }, RECENT.id),
    ).toEqual(err(UNAVAILABLE));
  });
});
