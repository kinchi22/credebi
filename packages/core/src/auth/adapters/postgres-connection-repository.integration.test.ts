import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type ConnectionId, type UserId } from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { DEFAULT_SETTINGS } from '../../settings/domain/settings';
import {
  ACCESS_TOKEN_SECONDS,
  accessTokenExpiry,
  accessTokenLive,
  refreshTokenExpiry,
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type RefreshRotation,
  type RefreshTokenHash,
} from '../domain/connection';
import { type User } from '../domain/user';
import { createPostgresConnectionRepository } from './postgres-connection-repository';
import { createPostgresUserRepository } from './postgres-user-repository';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

const repository = createPostgresConnectionRepository(databaseUrl, logger);
const dead = createPostgresConnectionRepository(UNREACHABLE_URL, logger);
const users = createPostgresUserRepository(databaseUrl, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), users.close(), close()]);
});

const user = (id: string, name: string): User => ({
  id: id as UserId,
  email: `${name.toLowerCase()}@example.com`,
  name,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
});

const ADA = user('01920000-0000-7000-8000-000000000001', 'Ada');
const BOB = user('01920000-0000-7000-8000-000000000002', 'Bob');

const ISSUED_AT = new Date('2026-11-07T09:00:00.123+09:00');

beforeEach(async () => {
  await database.execute(sql`truncate table users cascade`);
  for (const one of [ADA, BOB]) {
    await users.add(
      one,
      { provider: 'google', subject: `google-${one.id}` },
      { accounts: [], groups: [] },
      DEFAULT_SETTINGS,
    );
  }
  logged.length = 0;
});

const connection = (id: string, userId: UserId = ADA.id): Connection => ({
  id: id as ConnectionId,
  userId,
  clientId: 'https://client.example/client.json',
  clientName: 'Example client',
  redirectUris: ['https://client.example/callback', 'http://127.0.0.1/callback'],
  scopes: ['read'],
  createdAt: ISSUED_AT,
  lastUsedAt: ISSUED_AT,
});

const tokens = (name: string): IssuedTokens => ({
  accessTokenHash: `access-${name}` as AccessTokenHash,
  accessTokenExpiresAt: accessTokenExpiry(ISSUED_AT),
  refreshTokenHash: `refresh-${name}` as RefreshTokenHash,
  refreshTokenExpiresAt: refreshTokenExpiry(ISSUED_AT),
});

const CONNECTION_A = '01920000-0000-7000-8000-0000000000c1';
const CONNECTION_B = '01920000-0000-7000-8000-0000000000c2';

const findRefresh = (name: string) =>
  repository.findRefreshToken(`refresh-${name}` as RefreshTokenHash);

const rotation = (
  replaced: string,
  next: string,
  discards?: string,
  connectionId: string = CONNECTION_A,
): RefreshRotation => ({
  connectionId: connectionId as ConnectionId,
  replaced: `refresh-${replaced}` as RefreshTokenHash,
  discards: discards === undefined ? undefined : (`refresh-${discards}` as RefreshTokenHash),
  tokens: tokens(next),
  rotatedAt: ISSUED_AT,
});

const ROTATED: unknown = { ok: true, value: 'rotated' };
const OVERTAKEN: unknown = { ok: true, value: 'overtaken' };

const find = (name: string) => repository.findAccessToken(`access-${name}` as AccessTokenHash);

describe('createPostgresConnectionRepository', () => {
  it('opens a Connection with its Access token and refresh token, stored by their hashes', async () => {
    expect(isOk(await repository.open(connection(CONNECTION_A), tokens('a')))).toBe(true);

    expect(
      await database.select().from(schema.connections).where(eq(schema.connections.id, CONNECTION_A)),
    ).toEqual([{ ...connection(CONNECTION_A), approvedRedirectUri: '' }]);
    expect(await database.select().from(schema.refreshTokens)).toEqual([
      {
        tokenHash: 'refresh-a',
        connectionId: CONNECTION_A,
        expiresAt: refreshTokenExpiry(ISSUED_AT),
        replacedByHash: null,
      },
    ]);
    expect(logged).toEqual([]);
  });

  it('finds an Access token by its hash, with its Connection\'s User, client and scopes', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    expect(await find('a')).toEqual({
      ok: true,
      value: {
        connectionId: CONNECTION_A,
        userId: ADA.id,
        clientId: 'https://client.example/client.json',
        scopes: ['read'],
        expiresAt: accessTokenExpiry(ISSUED_AT),
      },
    });
  });

  it('keeps an Access token live until one hour after it was issued, and no longer', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    const found = await find('a');
    const expiresAt = isOk(found) ? found.value?.expiresAt : undefined;
    const token = { expiresAt: expiresAt ?? new Date(0) };
    const hour = ACCESS_TOKEN_SECONDS * 1000;

    expect(expiresAt).toEqual(new Date(ISSUED_AT.getTime() + hour));
    expect(accessTokenLive(token, new Date(ISSUED_AT.getTime() + hour - 1))).toBe(true);
    expect(accessTokenLive(token, new Date(ISSUED_AT.getTime() + hour))).toBe(false);
  });

  it('finds nothing for a hash it never stored, nor for a refresh token\'s hash', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    expect(await find('never')).toEqual({ ok: true, value: undefined });
    expect(await repository.findAccessToken('refresh-a' as AccessTokenHash)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('opens a Connection for each consent, even of the same client by the same User', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.open(connection(CONNECTION_B), tokens('b'));

    expect(await database.select().from(schema.connections)).toHaveLength(2);
    expect(await find('b')).toMatchObject({
      value: { connectionId: CONNECTION_B },
    });
  });

  it('keeps each User\'s Access tokens to that User', async () => {
    await repository.open(connection(CONNECTION_A, ADA.id), tokens('ada'));
    await repository.open(connection(CONNECTION_B, BOB.id), tokens('bob'));

    expect(await find('ada')).toMatchObject({ value: { userId: ADA.id } });
    expect(await find('bob')).toMatchObject({ value: { userId: BOB.id } });
  });

  it('stores nothing of a Connection whose token cannot be stored', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    const result = await repository.open(connection(CONNECTION_B), tokens('a'));

    expect(isErr(result) && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(
      await database.select().from(schema.connections).where(eq(schema.connections.id, CONNECTION_B)),
    ).toEqual([]);
  });

  it('deletes the Connections and tokens of a User who is deleted, and only theirs', async () => {
    await repository.open(connection(CONNECTION_A, ADA.id), tokens('ada'));
    await repository.open(connection(CONNECTION_B, BOB.id), tokens('bob'));

    await database.execute(sql`delete from users where id = ${ADA.id}`);

    expect(await find('ada')).toEqual({ ok: true, value: undefined });
    expect(await database.select().from(schema.refreshTokens)).toHaveLength(1);
    expect(await find('bob')).toMatchObject({ value: { userId: BOB.id } });
  });

  it('finds a refresh token by its hash, with its Connection, client and scopes, never yet rotated', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    expect(await findRefresh('a')).toEqual({
      ok: true,
      value: {
        tokenHash: 'refresh-a',
        connectionId: CONNECTION_A,
        clientId: 'https://client.example/client.json',
        scopes: ['read'],
        expiresAt: refreshTokenExpiry(ISSUED_AT),
        discarded: false,
        successor: undefined,
      },
    });
  });

  it('finds nothing for a refresh token it never stored, nor for an Access token\'s hash', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    expect(await findRefresh('never')).toEqual({ ok: true, value: undefined });
    expect(await repository.findRefreshToken('access-a' as RefreshTokenHash)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('rotates a refresh token: the new tokens work and the replaced one names its unused successor', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    expect(await repository.rotate(rotation('a', 'b'))).toEqual(ROTATED);

    expect(await find('b')).toMatchObject({ value: { connectionId: CONNECTION_A } });
    expect(await findRefresh('b')).toMatchObject({ value: { successor: undefined } });
    expect(await findRefresh('a')).toMatchObject({
      value: { successor: { tokenHash: 'refresh-b', used: false } },
    });
  });

  it('marks the successor used once it is rotated in turn', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.rotate(rotation('a', 'b'));
    await repository.rotate(rotation('b', 'c'));

    expect(await findRefresh('a')).toMatchObject({ value: { successor: { tokenHash: 'refresh-b', used: true } } });
    expect(await findRefresh('b')).toMatchObject({
      value: { successor: { tokenHash: 'refresh-c', used: false } },
    });
  });

  it('rotating a replaced token again discards its unused successor and names the new one', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.rotate(rotation('a', 'b'));

    expect(await repository.rotate(rotation('a', 'c', 'b'))).toEqual(ROTATED);

    expect(await findRefresh('b')).toMatchObject({
      value: { tokenHash: 'refresh-b', discarded: true, successor: undefined },
    });
    expect(await findRefresh('a')).toMatchObject({
      value: { discarded: false, successor: { tokenHash: 'refresh-c', used: false } },
    });
  });

  it('refuses to rotate a discarded successor, storing nothing', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.rotate(rotation('a', 'b'));
    await repository.rotate(rotation('a', 'c', 'b'));

    expect(await repository.rotate(rotation('b', 'd'))).toEqual(OVERTAKEN);
    expect(await find('d')).toEqual({ ok: true, value: undefined });
  });

  it('deletes, as it rotates, the Connection\'s refresh tokens expired by then, and no other\'s', async () => {
    await repository.open(connection(CONNECTION_A, ADA.id), tokens('ada'));
    await repository.open(connection(CONNECTION_B, BOB.id), tokens('bob'));
    const stored = (tokenHash: string, connectionId: string, expiresAt: Date) => ({
      tokenHash,
      connectionId,
      expiresAt,
    });
    await database.insert(schema.refreshTokens).values([
      stored('ada-expired', CONNECTION_A, new Date(ISSUED_AT.getTime() - 1)),
      stored('ada-expiring', CONNECTION_A, ISSUED_AT),
      stored('ada-live', CONNECTION_A, new Date(ISSUED_AT.getTime() + 1)),
      stored('bob-expired', CONNECTION_B, new Date(ISSUED_AT.getTime() - 1)),
    ]);

    expect(await repository.rotate(rotation('ada', 'next'))).toEqual(ROTATED);

    const left = await database.select({ tokenHash: schema.refreshTokens.tokenHash }).from(schema.refreshTokens);
    expect(left.map((row) => row.tokenHash).sort()).toEqual([
      'ada-live',
      'bob-expired',
      'refresh-ada',
      'refresh-bob',
      'refresh-next',
    ]);
  });

  it('keeps every expired refresh token of a rotation that was overtaken', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.rotate(rotation('a', 'b'));
    await database.insert(schema.refreshTokens).values({
      tokenHash: 'a-expired',
      connectionId: CONNECTION_A,
      expiresAt: new Date(ISSUED_AT.getTime() - 1),
    });

    expect(await repository.rotate(rotation('a', 'c'))).toEqual(OVERTAKEN);
    expect(
      await database.select().from(schema.refreshTokens).where(eq(schema.refreshTokens.tokenHash, 'a-expired')),
    ).toHaveLength(1);
  });

  it('rotates a refresh token once when two rotations race for it, storing nothing of the other', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));

    const outcomes = await Promise.all([
      repository.rotate(rotation('a', 'b')),
      repository.rotate(rotation('a', 'c')),
    ]);

    expect(outcomes.map((outcome) => isOk(outcome) && outcome.value).sort()).toEqual([
      'overtaken',
      'rotated',
    ]);
    expect(await database.select().from(schema.refreshTokens)).toHaveLength(2);
    expect(await database.select().from(schema.accessTokens)).toHaveLength(2);
  });

  it('refuses to discard a successor that was used meanwhile, storing nothing', async () => {
    await repository.open(connection(CONNECTION_A), tokens('a'));
    await repository.rotate(rotation('a', 'b'));
    await repository.rotate(rotation('b', 'c'));

    expect(await repository.rotate(rotation('a', 'd', 'b'))).toEqual(OVERTAKEN);
    expect(await find('d')).toEqual({ ok: true, value: undefined });
  });

  it('rotates no refresh token through another User\'s Connection', async () => {
    await repository.open(connection(CONNECTION_A, ADA.id), tokens('ada'));
    await repository.open(connection(CONNECTION_B, BOB.id), tokens('bob'));

    expect(await repository.rotate(rotation('ada', 'stolen', undefined, CONNECTION_B))).toEqual(
      OVERTAKEN,
    );
    expect(await find('stolen')).toEqual({ ok: true, value: undefined });
  });

  it('revokes a Connection with every token it holds, leaving another User\'s alone', async () => {
    await repository.open(connection(CONNECTION_A, ADA.id), tokens('ada'));
    await repository.open(connection(CONNECTION_B, BOB.id), tokens('bob'));
    await repository.rotate(rotation('ada', 'next'));

    expect(await repository.revoke(CONNECTION_A as ConnectionId)).toEqual({ ok: true, value: undefined });

    for (const name of ['ada', 'next']) {
      expect(await find(name)).toEqual({ ok: true, value: undefined });
      expect(await findRefresh(name)).toEqual({ ok: true, value: undefined });
    }
    expect(await find('bob')).toMatchObject({ value: { userId: BOB.id } });
    expect(await findRefresh('bob')).toMatchObject({ value: { connectionId: CONNECTION_B } });
  });

  it('reports an unreachable database as a result, never by throwing, without logging a hash', async () => {
    const opened = await dead.open(connection(CONNECTION_A), tokens('a'));
    const found = await dead.findAccessToken('access-a' as AccessTokenHash);
    const foundRefresh = await dead.findRefreshToken('refresh-a' as RefreshTokenHash);
    const rotated = await dead.rotate(rotation('a', 'b'));
    const revoked = await dead.revoke(CONNECTION_A as ConnectionId);

    expect(
      [opened, found, foundRefresh, rotated, revoked].map(
        (result) => !result.ok && result.error.code,
      ),
    ).toEqual(Array.from({ length: 5 }, () => 'DEPENDENCY_UNAVAILABLE'));
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.open_connection_failed',
      'auth.find_access_token_failed',
      'auth.find_refresh_token_failed',
      'auth.rotate_refresh_token_failed',
      'auth.revoke_connection_failed',
    ]);
    for (const hash of ['access-a', 'refresh-a', 'refresh-b']) {
      expect(JSON.stringify(logged)).not.toContain(hash);
    }
  });
});
