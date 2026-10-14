import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, ok, type AccountGroupId, type AccountId, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
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
  groupId: null,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const chartOf = (...accounts: Account[]): Chart => ({ accounts, groups: [] });

const group = (
  n: number,
  accountType: AccountGroup['accountType'],
  position: number,
  name: string,
): AccountGroup => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId,
  accountType,
  name,
  description: null,
  position,
});

async function store(userId: UserId, stored: Account): Promise<void> {
  await database.execute(
    sql`insert into accounts (id, user_id, account_type, group_id, name, description, position, active_from, active_until)
        values (${stored.id}, ${userId}, ${stored.accountType}, ${stored.groupId}, ${stored.name}, ${stored.description},
                ${stored.position}, ${stored.activeFrom}, ${stored.activeUntil})`,
  );
}

async function storeGroup(userId: UserId, stored: AccountGroup): Promise<void> {
  await database.execute(
    sql`insert into account_groups (id, user_id, account_type, name, description, position)
        values (${stored.id}, ${userId}, ${stored.accountType}, ${stored.name}, ${stored.description},
                ${stored.position})`,
  );
}

async function storeEntry(
  userId: UserId,
  n: number,
  lines: readonly [Account, Account],
  reverses: string | null = null,
  day = '2026-09-15',
): Promise<string> {
  const id = `01920000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  await database.execute(
    sql`insert into entries (id, user_id, entry_date, memo, created_at, reverses_entry_id)
        values (${id}, ${userId}, ${day}, ${`Entry ${String(n)}`}, now(), ${reverses})`,
  );
  for (const [index, named] of lines.entries()) {
    await database.execute(
      sql`insert into entry_lines (entry_id, line_number, account_id, side, amount)
          values (${id}, ${index + 1}, ${named.id}, ${index === 0 ? 'debit' : 'credit'}, 1000)`,
    );
  }
  return id;
}

const MOMENT = new Date('2026-10-14T02:00:00.000Z');

async function storedRemovals(): Promise<{ id: string; removedAt: Date | null }[]> {
  const rows = await database.execute<{ id: string; removed_at: Date | string | null }>(
    sql`select id, removed_at from accounts order by id`,
  );
  return rows.rows.map((row) => ({
    id: row.id,
    removedAt: row.removed_at === null ? null : new Date(row.removed_at),
  }));
}

async function untilWaitingOnLock(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const waiting = await database.execute<{ count: number }>(
      sql`select count(*)::int as count from pg_stat_activity
          where wait_event_type = 'Lock' and query ilike '%for update%'`,
    );
    if ((waiting.rows[0]?.count ?? 0) > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('The removal never waited on the Account row.');
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

    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(expenses, cash, rent)));
    expect(logged).toEqual([]);
  });

  it("never reads another User's Accounts", async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const wallet = account(2, 'asset', 0, 'Wallet');
    await store(ADA, cash);
    await store(GRACE, wallet);

    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(cash)));
    expect(await repository.readChart(GRACE)).toEqual(ok(chartOf(wallet)));
  });

  it('reads an empty chart for a User with no Accounts', async () => {
    expect(await repository.readChart(ADA)).toEqual(ok(chartOf()));
  });

  it('reports a stored Account of no Account type rather than answering with it', async () => {
    const odd = { ...account(1, 'asset', 0, 'Odd'), accountType: 'cash' } as unknown as Account;
    await store(ADA, odd);

    const read = await repository.readChart(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([{ event: 'accounts.stored_account_invalid', accountId: odd.id }]);
  });

  it('reports a stored Account with no position rather than answering with it', async () => {
    const unplaced = account(1, 'asset', 0, 'Unplaced');
    await store(ADA, unplaced);
    await database.execute(sql`update accounts set position = null where id = ${unplaced.id}`);

    const read = await repository.readChart(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([{ event: 'accounts.stored_account_unplaced', accountId: unplaced.id }]);
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

  it('adds an Account that is read back with the chart, and only with its own User\'s', async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const wallet = { ...account(2, 'asset', 1, 'Wallet'), description: 'Cash I carry', activeUntil: '2026-12-31' };
    await store(ADA, cash);

    expect(await repository.addAccount(ADA, wallet)).toEqual(ok(undefined));

    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(cash, wallet)));
    expect(await repository.readChart(GRACE)).toEqual(ok(chartOf()));
  });

  it('updates the name, description, Active period and place of an Account', async () => {
    const cash = account(1, 'asset', 3, 'Cash');
    await store(ADA, cash);
    const wallet = {
      ...cash,
      position: 0,
      name: 'Wallet',
      description: 'Cash I carry',
      activeFrom: '2026-08-01',
      activeUntil: '2026-12-31',
    };

    expect(await repository.updateAccount(ADA, wallet)).toEqual(ok(undefined));

    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(wallet)));
  });

  it("refuses to update another User's Account as not found, and leaves it untouched", async () => {
    const safe = account(1, 'asset', 0, 'Safe');
    await store(GRACE, safe);

    const updated = await repository.updateAccount(ADA, { ...safe, name: 'Mine now' });

    expect(isErr(updated) && updated.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(GRACE)).toEqual(ok(chartOf(safe)));
  });

  it("enforces one name per User's Accounts, ignoring case, while another User may use it", async () => {
    await store(ADA, account(1, 'asset', 0, 'Cash'));
    const sales = account(2, 'revenue', 0, 'Sales');
    await store(ADA, sales);

    const added = await repository.addAccount(ADA, account(3, 'expense', 0, 'CASH'));
    const renamed = await repository.updateAccount(ADA, { ...sales, name: 'cash' });

    expect(isErr(added) && added.error.code).toBe('NAME_TAKEN');
    expect(isErr(renamed) && renamed.error.code).toBe('NAME_TAKEN');
    expect(await repository.addAccount(GRACE, account(4, 'asset', 0, 'cash'))).toEqual(ok(undefined));
    expect(logged).toEqual([]);
  });

  it("reads a User's Account groups by position, with the Accounts each holds", async () => {
    const savings = { ...group(10, 'asset', 2, 'Savings'), description: 'Put aside' };
    const bank = group(11, 'asset', 1, 'Bank');
    const abcBank = { ...account(1, 'asset', 0, 'ABC Bank'), groupId: bank.id };
    await storeGroup(ADA, savings);
    await storeGroup(ADA, bank);
    await store(ADA, abcBank);
    await storeGroup(GRACE, group(12, 'asset', 0, 'Bank'));

    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [abcBank], groups: [bank, savings] }));
  });

  it('reports a stored Account group of no Account type rather than answering with it', async () => {
    const odd = { ...group(10, 'asset', 0, 'Odd'), accountType: 'cash' } as unknown as AccountGroup;
    await storeGroup(ADA, odd);

    const read = await repository.readChart(ADA);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([{ event: 'accounts.stored_group_invalid', accountGroupId: odd.id }]);
  });

  it("adds an Account group that is read back with the chart, and only with its own User's", async () => {
    const bank = { ...group(10, 'asset', 1, 'Bank'), description: 'Accounts at a bank' };

    expect(await repository.addGroup(ADA, bank)).toEqual(ok(undefined));

    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [], groups: [bank] }));
    expect(await repository.readChart(GRACE)).toEqual(ok(chartOf()));
  });

  it('updates the name and description of an Account group, and keeps its place', async () => {
    const bank = group(10, 'asset', 3, 'Bank');
    await storeGroup(ADA, bank);
    const banks = { ...bank, position: 0, name: 'Banks', description: 'Current accounts' };

    expect(await repository.updateGroup(ADA, banks)).toEqual(ok(undefined));

    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [], groups: [{ ...banks, position: 3 }] }));
  });

  it("refuses to update another User's Account group as not found, and leaves it untouched", async () => {
    const bank = group(10, 'asset', 0, 'Bank');
    await storeGroup(GRACE, bank);

    const updated = await repository.updateGroup(ADA, { ...bank, name: 'Mine now' });

    expect(isErr(updated) && updated.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(GRACE)).toEqual(ok({ accounts: [], groups: [bank] }));
  });

  it('enforces one name per Account type among a User\'s Account groups, ignoring case', async () => {
    await storeGroup(ADA, group(10, 'asset', 0, 'Bank'));
    const savings = group(11, 'asset', 1, 'Savings');
    await storeGroup(ADA, savings);

    const added = await repository.addGroup(ADA, group(12, 'asset', 2, 'BANK'));
    const renamed = await repository.updateGroup(ADA, { ...savings, name: 'bank' });

    expect(isErr(added) && added.error.code).toBe('NAME_TAKEN');
    expect(isErr(renamed) && renamed.error.code).toBe('NAME_TAKEN');
    expect(await repository.addGroup(ADA, group(13, 'liability', 0, 'bank'))).toEqual(ok(undefined));
    expect(await repository.addGroup(GRACE, group(14, 'asset', 0, 'bank'))).toEqual(ok(undefined));
    expect(logged).toEqual([]);
  });

  it('moves an Account into an Account group and out of it, at the place it is given', async () => {
    const bank = group(10, 'asset', 1, 'Bank');
    const cash = account(1, 'asset', 0, 'Cash');
    await storeGroup(ADA, bank);
    await store(ADA, cash);
    const banked = { ...cash, groupId: bank.id, position: 4 };

    expect(await repository.updateAccount(ADA, banked)).toEqual(ok(undefined));
    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [banked], groups: [bank] }));

    const unbanked = { ...cash, position: 2 };
    expect(await repository.updateAccount(ADA, unbanked)).toEqual(ok(undefined));
    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [unbanked], groups: [bank] }));
  });

  it("refuses to save an Account into an Account group of another Account type, or another User's, and keeps the chart as it was", async () => {
    const loans = group(10, 'liability', 0, 'Loans');
    const gracesBank = group(11, 'asset', 0, 'Bank');
    await storeGroup(ADA, loans);
    await storeGroup(GRACE, gracesBank);
    const cash = account(1, 'asset', 0, 'Cash');
    await store(ADA, cash);

    const otherType = await repository.updateAccount(ADA, { ...cash, groupId: loans.id });
    const otherUser = await repository.addAccount(ADA, {
      ...account(2, 'asset', 0, 'Wallet'),
      groupId: gracesBank.id,
    });

    expect(isErr(otherType) && otherType.error.code).toBe('NOT_FOUND');
    expect(isErr(otherUser) && otherUser.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [cash], groups: [loans] }));
    expect(logged).toEqual([]);
  });

  it('reports an unreachable database on a save as a result, never by throwing', async () => {
    const wallet = account(1, 'asset', 0, 'Wallet');
    const bank = group(10, 'asset', 0, 'Bank');

    const added = await dead.addAccount(ADA, wallet);
    const updated = await dead.updateAccount(ADA, wallet);
    const addedGroup = await dead.addGroup(ADA, bank);
    const updatedGroup = await dead.updateGroup(ADA, bank);

    expect(isErr(added) && added.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(updated) && updated.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(addedGroup) && addedGroup.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(updatedGroup) && updatedGroup.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields['event'])).toEqual([
      'accounts.add_failed',
      'accounts.update_failed',
      'accounts.add_group_failed',
      'accounts.update_group_failed',
    ]);
  });
  it('saves the places of the nodes it is given in one go, and reads them back in that order', async () => {
    const bank = group(10, 'asset', 1, 'Bank');
    const cash = account(1, 'asset', 0, 'Cash');
    const wallet = account(2, 'asset', 2, 'Wallet');
    const abcBank = { ...account(3, 'asset', 0, 'ABC Bank'), groupId: bank.id };
    await storeGroup(ADA, bank);
    for (const stored of [cash, wallet, abcBank]) {
      await store(ADA, stored);
    }
    const placed = {
      accounts: [
        { ...wallet, position: 0 },
        { ...abcBank, groupId: null, position: 1 },
        { ...cash, position: 3 },
      ],
      groups: [{ ...bank, position: 2 }],
    };

    expect(await repository.placeNodes(ADA, placed)).toEqual(ok(undefined));
    expect(await repository.readChart(ADA)).toEqual(ok(placed));
    expect(logged).toEqual([]);
  });

  it("refuses to place another User's node, or an Account into an Account group of another Account type, as not found, and places nothing", async () => {
    const loans = group(10, 'liability', 0, 'Loans');
    const bank = group(11, 'asset', 1, 'Bank');
    const cash = account(1, 'asset', 0, 'Cash');
    const gracesWallet = account(2, 'asset', 0, 'Wallet');
    const gracesBank = group(12, 'asset', 0, 'Bank');
    await storeGroup(ADA, loans);
    await storeGroup(ADA, bank);
    await store(ADA, cash);
    await store(GRACE, gracesWallet);
    await storeGroup(GRACE, gracesBank);
    const unmoved = ok({ accounts: [cash], groups: [loans, bank] });

    const graces = await repository.placeNodes(ADA, {
      accounts: [{ ...cash, position: 5 }, { ...gracesWallet, position: 6 }],
      groups: [],
    });
    const gracesGroup = await repository.placeNodes(ADA, {
      accounts: [],
      groups: [{ ...bank, position: 5 }, { ...gracesBank, position: 6 }],
    });
    const otherType = await repository.placeNodes(ADA, {
      accounts: [{ ...cash, groupId: loans.id }],
      groups: [{ ...bank, position: 7 }],
    });

    expect(isErr(graces) && graces.error.code).toBe('NOT_FOUND');
    expect(isErr(gracesGroup) && gracesGroup.error.code).toBe('NOT_FOUND');
    expect(isErr(otherType) && otherType.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(ADA)).toEqual(unmoved);
    expect(await repository.readChart(GRACE)).toEqual(
      ok({ accounts: [gracesWallet], groups: [gracesBank] }),
    );
    expect(logged).toEqual([]);
  });

  it('reports an unreachable database on placing nodes as a result, never by throwing', async () => {
    const placed = await dead.placeNodes(ADA, chartOf(account(1, 'asset', 0, 'Cash')));

    expect(isErr(placed) && placed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields['event'])).toEqual(['accounts.place_failed']);
  });

  it('removes an Account by how Entry lines name it: refused while a shown Entry does, marked while only a hidden pair does, else deleted', async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const sales = account(2, 'revenue', 0, 'Sales');
    const wallet = account(3, 'asset', 1, 'Wallet');
    const float = account(4, 'asset', 2, 'Float');
    for (const stored of [cash, sales, wallet, float]) {
      await store(ADA, stored);
    }
    await storeEntry(ADA, 100, [cash, sales]);
    const deleted = await storeEntry(ADA, 101, [cash, float]);
    await storeEntry(ADA, 102, [float, cash], deleted);

    expect(await repository.removeAccount(ADA, cash.id, MOMENT)).toEqual(ok('refused'));
    expect(await repository.removeAccount(ADA, float.id, MOMENT)).toEqual(ok('marked'));
    expect(await repository.removeAccount(ADA, wallet.id, MOMENT)).toEqual(ok('deleted'));

    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(cash, sales)));
    expect(await storedRemovals()).toEqual([
      { id: cash.id, removedAt: null },
      { id: sales.id, removedAt: null },
      { id: float.id, removedAt: MOMENT },
    ]);
    expect(logged).toEqual([]);
  });

  it('marks an Account removed once a Correction moved the only shown Entry naming it to another Account', async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const float = account(2, 'asset', 1, 'Float');
    const expenses = account(3, 'expense', 0, 'Expenses');
    for (const stored of [cash, float, expenses]) {
      await store(ADA, stored);
    }
    const corrected = await storeEntry(ADA, 100, [expenses, float]);
    await storeEntry(ADA, 101, [float, expenses], corrected);
    await storeEntry(ADA, 102, [expenses, cash]);

    expect(await repository.removeAccount(ADA, float.id, MOMENT)).toEqual(ok('marked'));
    expect(await repository.removeAccount(ADA, cash.id, MOMENT)).toEqual(ok('refused'));
  });

  it('clears the Account group and position of an Account it marks removed, and keeps its row for the hidden pair naming it', async () => {
    const bank = group(10, 'asset', 1, 'Bank');
    const sales = account(1, 'revenue', 0, 'Sales');
    const float = { ...account(2, 'asset', 0, 'Float'), groupId: bank.id };
    await storeGroup(ADA, bank);
    await store(ADA, sales);
    await store(ADA, float);
    const deleted = await storeEntry(ADA, 100, [float, sales]);
    await storeEntry(ADA, 101, [sales, float], deleted);

    await repository.removeAccount(ADA, float.id, MOMENT);

    const rows = await database.execute<{ group_id: string | null; position: number | null }>(
      sql`select group_id, position from accounts where id = ${float.id}`,
    );
    expect(rows.rows).toEqual([{ group_id: null, position: null }]);
    expect(await repository.deleteGroup(ADA, bank.id)).toEqual(ok(undefined));
  });

  it("refuses to remove another User's Account, or one already removed, as not found, and leaves it", async () => {
    const safe = account(1, 'asset', 0, 'Safe');
    const sales = account(2, 'revenue', 0, 'Sales');
    const float = account(3, 'asset', 1, 'Float');
    await store(GRACE, safe);
    await store(ADA, sales);
    await store(ADA, float);
    const deleted = await storeEntry(ADA, 100, [float, sales]);
    await storeEntry(ADA, 101, [sales, float], deleted);
    await repository.removeAccount(ADA, float.id, MOMENT);

    const others = await repository.removeAccount(ADA, safe.id, MOMENT);
    const again = await repository.removeAccount(ADA, float.id, new Date('2026-10-15T02:00:00.000Z'));

    expect(isErr(others) && others.error.code).toBe('NOT_FOUND');
    expect(isErr(again) && again.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(GRACE)).toEqual(ok(chartOf(safe)));
    expect(await storedRemovals()).toEqual([
      { id: safe.id, removedAt: null },
      { id: sales.id, removedAt: null },
      { id: float.id, removedAt: MOMENT },
    ]);
  });

  it('waits for an Entry write that holds the Account, then refuses the removal once that Entry is shown', async () => {
    const sales = account(1, 'revenue', 0, 'Sales');
    const float = account(2, 'asset', 1, 'Float');
    await store(ADA, sales);
    await store(ADA, float);
    const deleted = await storeEntry(ADA, 100, [float, sales]);
    await storeEntry(ADA, 101, [sales, float], deleted);
    const writer = createDatabase(databaseUrl);
    let removal: ReturnType<typeof repository.removeAccount> | undefined;

    await writer.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`insert into entries (id, user_id, entry_date, memo, created_at)
            values ('01920000-0000-7000-8000-000000000102', ${ADA}, '2026-09-15', 'Racing', now())`,
      );
      await transaction.execute(
        sql`insert into entry_lines (entry_id, line_number, account_id, side, amount)
            values ('01920000-0000-7000-8000-000000000102', 1, ${float.id}, 'debit', 1000),
                   ('01920000-0000-7000-8000-000000000102', 2, ${sales.id}, 'credit', 1000)`,
      );
      removal = repository.removeAccount(ADA, float.id, MOMENT);
      await untilWaitingOnLock();
    });
    await writer.close();

    expect(await removal).toEqual(ok('refused'));
    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(sales, float)));
  });

  it("frees a removed Account's name for a new Account, ignoring case, while an Account not removed keeps its own", async () => {
    const sales = account(1, 'revenue', 0, 'Sales');
    const float = account(2, 'asset', 0, 'Float');
    await store(ADA, sales);
    await store(ADA, float);
    const deleted = await storeEntry(ADA, 100, [float, sales]);
    await storeEntry(ADA, 101, [sales, float], deleted);
    await repository.removeAccount(ADA, float.id, MOMENT);
    const reused = account(3, 'asset', 0, 'FLOAT');
    const clash = account(4, 'asset', 1, 'float');

    expect(await repository.addAccount(ADA, reused)).toEqual(ok(undefined));
    const taken = await repository.addAccount(ADA, clash);

    expect(isErr(taken) && taken.error.code).toBe('NAME_TAKEN');
    expect(await repository.readChart(ADA)).toEqual(ok(chartOf(sales, reused)));
  });

  it('never saves or places a removed Account, so a stale chart cannot put it back in an Account group', async () => {
    const bank = group(10, 'asset', 1, 'Bank');
    const sales = account(1, 'revenue', 0, 'Sales');
    const float = account(2, 'asset', 0, 'Float');
    await storeGroup(ADA, bank);
    await store(ADA, sales);
    await store(ADA, float);
    const deleted = await storeEntry(ADA, 100, [float, sales]);
    await storeEntry(ADA, 101, [sales, float], deleted);
    await repository.removeAccount(ADA, float.id, MOMENT);
    const stale = { ...float, groupId: bank.id, position: 3 };

    const updated = await repository.updateAccount(ADA, stale);
    const placed = await repository.placeNodes(ADA, { accounts: [stale], groups: [] });

    expect(isErr(updated) && updated.error.code).toBe('NOT_FOUND');
    expect(isErr(placed) && placed.error.code).toBe('NOT_FOUND');
    const rows = await database.execute<{ group_id: string | null; position: number | null }>(
      sql`select group_id, position from accounts where id = ${float.id}`,
    );
    expect(rows.rows).toEqual([{ group_id: null, position: null }]);
    expect(await repository.deleteGroup(ADA, bank.id)).toEqual(ok(undefined));
  });

  it('reads the first and last day a shown Entry names an Account on, leaving out a Reversal and the Entry it reverses', async () => {
    const cash = account(1, 'asset', 0, 'Cash');
    const sales = account(2, 'revenue', 0, 'Sales');
    const wallet = account(3, 'asset', 1, 'Wallet');
    for (const stored of [cash, sales, wallet]) {
      await store(ADA, stored);
    }
    await storeEntry(ADA, 100, [cash, sales], null, '2026-09-10');
    await storeEntry(ADA, 101, [cash, sales], null, '2026-09-20');
    await storeEntry(ADA, 102, [cash, sales], null, '2026-09-12');
    const reversed = await storeEntry(ADA, 103, [cash, wallet], null, '2026-08-01');
    await storeEntry(ADA, 104, [wallet, cash], reversed, '2026-10-01');

    expect(await repository.readShownSpan(ADA, cash.id)).toEqual(
      ok({ first: '2026-09-10', last: '2026-09-20' }),
    );
    expect(await repository.readShownSpan(ADA, wallet.id)).toEqual(ok(null));
    expect(await repository.readShownSpan(GRACE, cash.id)).toEqual(ok(null));
  });

  it('reports an unreachable database on reading the days shown Entries name an Account on, as a result', async () => {
    const shown = await dead.readShownSpan(ADA, account(1, 'asset', 0, 'Cash').id);

    expect(isErr(shown) && shown.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields['event'])).toEqual(['accounts.shown_span_read_failed']);
  });

  it('deletes an empty Account group, refuses one that holds an Account as in use, and never deletes another User\'s', async () => {
    const loans = group(10, 'liability', 0, 'Loans');
    const cards = group(11, 'liability', 1, 'Cards');
    const gracesLoans = group(12, 'liability', 0, 'Loans');
    const visa = { ...account(1, 'liability', 0, 'Visa'), groupId: cards.id };
    await storeGroup(ADA, loans);
    await storeGroup(ADA, cards);
    await store(ADA, visa);
    await storeGroup(GRACE, gracesLoans);

    expect(await repository.deleteGroup(ADA, loans.id)).toEqual(ok(undefined));
    const holding = await repository.deleteGroup(ADA, cards.id);
    const others = await repository.deleteGroup(ADA, gracesLoans.id);

    expect(isErr(holding) && holding.error.code).toBe('IN_USE');
    expect(isErr(others) && others.error.code).toBe('NOT_FOUND');
    expect(await repository.readChart(ADA)).toEqual(ok({ accounts: [visa], groups: [cards] }));
    expect(await repository.readChart(GRACE)).toEqual(ok({ accounts: [], groups: [gracesLoans] }));
    expect(logged).toEqual([]);
  });

  it('reports an unreachable database on removing an Account or deleting an Account group as a result', async () => {
    const wallet = account(1, 'asset', 0, 'Wallet');
    const bank = group(10, 'asset', 0, 'Bank');

    const removed = await dead.removeAccount(ADA, wallet.id, MOMENT);
    const deletedGroup = await dead.deleteGroup(ADA, bank.id);

    expect(isErr(removed) && removed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(deletedGroup) && deletedGroup.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields['event'])).toEqual([
      'accounts.remove_failed',
      'accounts.delete_group_failed',
    ]);
  });
});
