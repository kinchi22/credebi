import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type UserId } from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { DEFAULT_SETTINGS } from '../../settings/domain/settings';
import { type AuthorizationCodeHash, type IssuedAuthorizationCode } from '../domain/authorization';
import { type User } from '../domain/user';
import { createPostgresAuthorizationCodeRepository } from './postgres-authorization-code-repository';
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

const repository = createPostgresAuthorizationCodeRepository(databaseUrl, logger);
const dead = createPostgresAuthorizationCodeRepository(UNREACHABLE_URL, logger);
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

const code = (codeHash: string, userId: UserId = ADA.id): IssuedAuthorizationCode => ({
  codeHash: codeHash as AuthorizationCodeHash,
  userId,
  clientId: 'https://client.example/client.json',
  clientName: 'Example client',
  redirectUris: ['https://client.example/callback', 'http://127.0.0.1/callback'],
  scopes: ['read', 'write'],
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  redirectUri: 'https://client.example/callback',
  resource: 'https://books.example/mcp',
  expiresAt: new Date('2026-11-07T09:01:00.123+09:00'),
});

async function stored(codeHash: string) {
  return database
    .select()
    .from(schema.authorizationCodes)
    .where(eq(schema.authorizationCodes.codeHash, codeHash));
}

describe('createPostgresAuthorizationCodeRepository', () => {
  it('stores an authorization code by its hash, with what its Connection will need', async () => {
    expect(isOk(await repository.add(code('hash-1')))).toBe(true);

    expect(await stored('hash-1')).toEqual([code('hash-1')]);
    expect(logged).toEqual([]);
  });

  it('keeps each User their own codes', async () => {
    await repository.add(code('hash-ada', ADA.id));
    await repository.add(code('hash-bob', BOB.id));

    expect((await stored('hash-ada')).map((one) => one.userId)).toEqual([ADA.id]);
    expect((await stored('hash-bob')).map((one) => one.userId)).toEqual([BOB.id]);
  });

  it('refuses a second code with the same hash, keeping the first', async () => {
    await repository.add(code('hash-1', ADA.id));

    const result = await repository.add(code('hash-1', BOB.id));

    expect(isErr(result) && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect((await stored('hash-1')).map((one) => one.userId)).toEqual([ADA.id]);
  });

  it('deletes the codes of a User who is deleted, and only theirs', async () => {
    await repository.add(code('hash-ada', ADA.id));
    await repository.add(code('hash-bob', BOB.id));

    await database.execute(sql`delete from users where id = ${ADA.id}`);

    expect(await stored('hash-ada')).toEqual([]);
    expect(await stored('hash-bob')).toHaveLength(1);
  });

  it('takes a code once: the first take answers it and deletes it, the second finds nothing', async () => {
    await repository.add(code('hash-1'));

    expect(await repository.take('hash-1' as AuthorizationCodeHash)).toEqual({
      ok: true,
      value: code('hash-1'),
    });
    expect(await repository.take('hash-1' as AuthorizationCodeHash)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await stored('hash-1')).toEqual([]);
  });

  it('gives a code to only one of two takes racing for it', async () => {
    await repository.add(code('hash-1'));

    const takes = await Promise.all([
      repository.take('hash-1' as AuthorizationCodeHash),
      repository.take('hash-1' as AuthorizationCodeHash),
    ]);

    expect(takes.filter((one) => isOk(one) && one.value !== undefined)).toHaveLength(1);
  });

  it('takes only the code of the hash it is given', async () => {
    await repository.add(code('hash-ada', ADA.id));
    await repository.add(code('hash-bob', BOB.id));

    await repository.take('hash-ada' as AuthorizationCodeHash);

    expect(await stored('hash-bob')).toHaveLength(1);
  });

  it('reports an unreachable database as a result, never by throwing, without logging the hash', async () => {
    const added = await dead.add(code('hash-1'));
    const taken = await dead.take('hash-1' as AuthorizationCodeHash);

    expect(isErr(added) && added.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(taken) && taken.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.add_authorization_code_failed',
      'auth.take_authorization_code_failed',
    ]);
    expect(JSON.stringify(logged)).not.toContain('hash-1');
  });
});
