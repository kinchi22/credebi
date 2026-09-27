import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, ok, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { createPostgresSettingsRepository } from './postgres-settings-repository';

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

const repository = createPostgresSettingsRepository(databaseUrl, logger);
const dead = createPostgresSettingsRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

beforeEach(async () => {
  await database.execute(sql`truncate table users, user_settings cascade`);
  for (const [id, email] of [
    [ADA, 'ada@example.com'],
    [GRACE, 'grace@example.com'],
  ]) {
    await database.execute(
      sql`insert into users (id, email, created_at) values (${id}, ${email}, now())`,
    );
  }
  logged.length = 0;
});

async function countRows(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from user_settings`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresSettingsRepository', () => {
  it('reads the defaults for a User with no stored Settings, and stores nothing', async () => {
    expect(await repository.read(ADA)).toEqual(ok(DEFAULT_SETTINGS));
    expect(await countRows()).toBe(0);
    expect(logged).toEqual([]);
  });

  it('reads back the Entry form mode it saved', async () => {
    expect(await repository.saveEntryFormMode(ADA, 'multi-line')).toEqual(ok(undefined));

    expect(await repository.read(ADA)).toEqual(ok({ entryFormMode: 'multi-line' }));
    expect(logged).toEqual([]);
  });

  it('keeps one row for a User who saves twice, holding the later mode', async () => {
    await repository.saveEntryFormMode(ADA, 'multi-line');
    await repository.saveEntryFormMode(ADA, 'two-line');

    expect(await repository.read(ADA)).toEqual(ok({ entryFormMode: 'two-line' }));
    expect(await countRows()).toBe(1);
  });

  it("leaves another User's Settings untouched (ADR-0021)", async () => {
    await repository.saveEntryFormMode(GRACE, 'two-line');

    await repository.saveEntryFormMode(ADA, 'multi-line');

    expect(await repository.read(GRACE)).toEqual(ok({ entryFormMode: 'two-line' }));
    expect(await repository.read(ADA)).toEqual(ok({ entryFormMode: 'multi-line' }));
  });

  it('reports a stored mode that is not an Entry form mode rather than answering with it', async () => {
    await database.execute(
      sql`insert into user_settings (user_id, entry_form_mode) values (${ADA}, 'three-line')`,
    );

    const read = await repository.read(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([
      { event: 'settings.stored_settings_invalid', userId: ADA },
    ]);
  });

  it('reports an unreachable database as a result on both paths, never by throwing', async () => {
    const read = await dead.read(ADA);
    const saved = await dead.saveEntryFormMode(ADA, 'multi-line');

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(saved) && saved.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([
      {
        event: 'settings.read_failed',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
      {
        event: 'settings.save_failed',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
    ]);
  });
});
