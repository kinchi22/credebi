import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type AccountId,
  type ConnectionId,
  type EntryId,
  type Money,
  type UserId,
} from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { makeEntry, type Entry } from '../domain/entry';
import { type RecordedRequestKey } from '../ports/request-key-repository';
import { createPostgresEntryRepository } from './postgres-entry-repository';
import { createPostgresUnitOfWork } from './postgres-unit-of-work';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

const repository = createPostgresEntryRepository(databaseUrl, logger);
const unitOfWork = createPostgresUnitOfWork(databaseUrl, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), unitOfWork.close(), close()]);
});

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;
const PHONE = '01920000-0000-7000-8000-0000000000e1' as ConnectionId;

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const GRACES_CASH = '01920000-0000-7000-8000-00000000d001' as AccountId;
const GRACES_EXPENSES = '01920000-0000-7000-8000-00000000d005' as AccountId;

const CHARTS = [
  [ADA, CASH, 'asset', 'Cash'],
  [ADA, EXPENSES, 'expense', 'Expenses'],
  [GRACE, GRACES_CASH, 'asset', 'Cash'],
  [GRACE, GRACES_EXPENSES, 'expense', 'Expenses'],
] as const;

const NAMES = new Map(CHARTS.map(([, id, , name]) => [id, { id, name }]));

const KEY = 'coffee-2026-09-15';

beforeEach(async () => {
  await database.execute(sql`truncate table users, entry_lines, entries cascade`);
  for (const [id, email] of [
    [ADA, 'ada@example.com'],
    [GRACE, 'grace@example.com'],
  ]) {
    await database.execute(
      sql`insert into users (id, email, created_at) values (${id}, ${email}, now())`,
    );
  }
  for (const [userId, id, accountType, name] of CHARTS) {
    await database.execute(
      sql`insert into accounts (id, user_id, account_type, name, position, active_from)
          values (${id}, ${userId}, ${accountType}, ${name}, 0, '2026-01-01')`,
    );
  }
  await database.execute(
    sql`insert into connections (id, user_id, client_id, client_name, redirect_uris, scopes, created_at, last_used_at)
        values (${PHONE}, ${ADA}, 'https://client.example/client.json', 'Example client',
                array['https://client.example/callback'], array['write'], now(), now())`,
  );
  logged.length = 0;
});

let sequence = 0;

function entryOf(userId: UserId): Entry {
  sequence += 1;
  const [cash, expenses] = userId === ADA ? [CASH, EXPENSES] : [GRACES_CASH, GRACES_EXPENSES];
  const made = makeEntry(
    {
      entryDate: '2026-09-15',
      title: 'Cafe',
      memo: 'Coffee',
      lines: [
        { account: expenses, side: 'debit', amount: 4500 as Money },
        { account: cash, side: 'credit', amount: 4500 as Money },
      ],
    },
    {
      id: `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId,
      createdAt: new Date('2026-09-15T00:30:00.000Z'),
    },
    NAMES,
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

const keyed = (entry: Entry, connectionId?: ConnectionId): RecordedRequestKey => ({
  requestKey: KEY,
  entryId: entry.id,
  connectionId,
});

async function postKeyed(userId: UserId, connectionId?: ConnectionId) {
  const entry = entryOf(userId);
  const done = await unitOfWork.run(async (entries, requestKeys) => {
    const saved = await entries.save(userId, entry);
    return saved.ok ? requestKeys.record(userId, keyed(entry, connectionId)) : saved;
  });
  return { entry, done };
}

const findKey = (userId: UserId, requestKey = KEY) =>
  unitOfWork.run((_, requestKeys) => requestKeys.find(userId, requestKey));

async function storedKeys(): Promise<readonly Record<string, unknown>[]> {
  const result = await database.execute(
    sql`select user_id, key, entry_id, connection_id from request_keys order by user_id`,
  );
  return result.rows;
}

describe('postgresRequestKeysOn', () => {
  it('records a key against the Entry posted with it, with the Connection that posted, and finds it', async () => {
    const { entry, done } = await postKeyed(ADA, PHONE);

    expect(done).toEqual(ok(undefined));
    expect(await findKey(ADA)).toEqual(ok(entry.id));
    expect(await storedKeys()).toEqual([
      { user_id: ADA, key: KEY, entry_id: entry.id, connection_id: PHONE },
    ]);
  });

  it('records a key sent without a Connection', async () => {
    const { entry } = await postKeyed(ADA);

    expect(await storedKeys()).toEqual([
      { user_id: ADA, key: KEY, entry_id: entry.id, connection_id: null },
    ]);
  });

  it('finds nothing for a key the User has not used', async () => {
    await postKeyed(ADA, PHONE);

    expect(await findKey(ADA, 'another key')).toEqual(ok(undefined));
  });

  it("never finds another User's key", async () => {
    await postKeyed(ADA, PHONE);

    expect(await findKey(GRACE)).toEqual(ok(undefined));
  });

  it('records the same key for each User who sends it', async () => {
    const adas = await postKeyed(ADA, PHONE);
    const graces = await postKeyed(GRACE);

    expect(graces.done).toEqual(ok(undefined));
    expect(await findKey(ADA)).toEqual(ok(adas.entry.id));
    expect(await findKey(GRACE)).toEqual(ok(graces.entry.id));
  });

  it('refuses as a conflict a key the User has used, rolling its Entry back and keeping the first', async () => {
    const first = await postKeyed(ADA, PHONE);

    const second = await postKeyed(ADA);

    expect(second.done).toEqual(
      err(domainError('CONFLICT', `Request key "${KEY}" is used already.`)),
    );
    expect(await findKey(ADA)).toEqual(ok(first.entry.id));
    expect(isErr(await repository.find(ADA, second.entry.id))).toBe(true);
    expect(logged).toEqual([]);
  });

  it('keeps the key when its Connection is revoked, naming no Connection', async () => {
    const { entry } = await postKeyed(ADA, PHONE);

    await database.execute(sql`delete from connections where id = ${PHONE}`);

    expect(await findKey(ADA)).toEqual(ok(entry.id));
    expect(await storedKeys()).toEqual([
      { user_id: ADA, key: KEY, entry_id: entry.id, connection_id: null },
    ]);
  });

  it('reports a key it cannot record, rolling its Entry back', async () => {
    const entry = entryOf(ADA);
    const unposted = entryOf(ADA);

    const done = await unitOfWork.run(async (entries, requestKeys) => {
      const saved = await entries.save(ADA, entry);
      return saved.ok ? requestKeys.record(ADA, keyed(unposted)) : saved;
    });

    expect(isErr(done) && done.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(await repository.find(ADA, entry.id))).toBe(true);
    expect(await storedKeys()).toEqual([]);
    expect(logged.map((fields) => fields.event)).toEqual(['entries.request_key_record_failed']);
  });
});
