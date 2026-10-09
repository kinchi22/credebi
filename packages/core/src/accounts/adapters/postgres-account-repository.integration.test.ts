import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, ok, type AccountId, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type Account } from '../domain/account';
import { createPostgresAccountRepository } from './postgres-account-repository';

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

const repository = createPostgresAccountRepository(databaseUrl, logger);
const dead = createPostgresAccountRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

const account = (
  n: number,
  accountType: Account['accountType'],
  position: number,
  name: string,
): Account => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId,
  accountType,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

async function store(userId: UserId, stored: Account): Promise<void> {
  await database.execute(
    sql`insert into accounts (id, user_id, account_type, name, description, position, active_from, active_until)
        values (${stored.id}, ${userId}, ${stored.accountType}, ${stored.name}, ${stored.description},
                ${stored.position}, ${stored.activeFrom}, ${stored.activeUntil})`,
  );
}

beforeEach(async () => {
  await database.execute(sql`truncate table users cascade`);
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

describe('createPostgresAccountRepository', () => {
  it("reads a User's Accounts with their Active periods, by position within the list", async () => {
    const rent = { ...account(1, 'expense', 1, 'Rent'), description: 'Flat', activeUntil: '2026-12-31' };
    const expenses = account(2, 'expense', 0, 'Expenses');
    const cash = account(3, 'asset', 0, 'Cash');
    for (const stored of [rent, expenses, cash]) {
      await store(ADA, stored);
    }

    expect(await repository.readChart(ADA)).toEqual(ok([expenses, cash, rent]));
    expect(logged).toEqual([]);
  });

  it("never reads another User's Accounts", async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const wallet = account(2, 'asset', 0, 'Wallet');
    await store(ADA, cash);
    await store(GRACE, wallet);

    expect(await repository.readChart(ADA)).toEqual(ok([cash]));
    expect(await repository.readChart(GRACE)).toEqual(ok([wallet]));
  });

  it('reads an empty chart for a User with no Accounts', async () => {
    expect(await repository.readChart(ADA)).toEqual(ok([]));
  });

  it('reports a stored Account of no Account type rather than answering with it', async () => {
    const odd = { ...account(1, 'asset', 0, 'Odd'), accountType: 'cash' } as unknown as Account;
    await store(ADA, odd);

    const read = await repository.readChart(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([{ event: 'accounts.stored_account_invalid', accountId: odd.id }]);
  });

  it('reports an unreachable database as a result, never by throwing', async () => {
    const read = await dead.readChart(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([
      {
        event: 'accounts.read_failed',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
    ]);
  });
});
