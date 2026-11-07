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
};

function connections(
  answer: Result<StoredAccessToken | undefined, DomainError> = ok(STORED),
): ConnectionRepository & { readonly looked: string[] } {
  const looked: string[] = [];
  return {
    looked,
    open: () => Promise.resolve(ok(undefined)),
    findAccessToken: (tokenHash) => {
      looked.push(tokenHash);
      return Promise.resolve(answer);
    },
  };
}

const resolving = (repository: ConnectionRepository, now: Date) =>
  createResolveAccessToken({
    connections: repository,
    hashAccessToken: (token) => `hash:${token}` as AccessTokenHash,
    now: () => now,
  });

describe('createResolveAccessToken', () => {
  it('resolves a live Access token, found by its hash, to its User and scopes', async () => {
    const repository = connections();

    const result = await resolving(repository, ISSUED_AT)('the-token');

    expect(result).toEqual(
      ok({
        auth: { userId: USER_ID, scopes: ['read', 'write'] },
        clientId: 'https://client.example/client.json',
        expiresAt: STORED.expiresAt,
      }),
    );
    expect(repository.looked).toEqual(['hash:the-token']);
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
