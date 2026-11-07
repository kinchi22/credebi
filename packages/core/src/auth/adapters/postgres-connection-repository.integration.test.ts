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

const find = (name: string) => repository.findAccessToken(`access-${name}` as AccessTokenHash);

describe('createPostgresConnectionRepository', () => {
  it('opens a Connection with its Access token and refresh token, stored by their hashes', async () => {
    expect(isOk(await repository.open(connection(CONNECTION_A), tokens('a')))).toBe(true);

    expect(
      await database.select().from(schema.connections).where(eq(schema.connections.id, CONNECTION_A)),
    ).toEqual([connection(CONNECTION_A)]);
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

  it('reports an unreachable database as a result, never by throwing, without logging a hash', async () => {
    const opened = await dead.open(connection(CONNECTION_A), tokens('a'));
    const found = await dead.findAccessToken('access-a' as AccessTokenHash);

    expect(isErr(opened) && opened.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(found) && found.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.open_connection_failed',
      'auth.find_access_token_failed',
    ]);
    expect(JSON.stringify(logged)).not.toContain('access-a');
  });
});
