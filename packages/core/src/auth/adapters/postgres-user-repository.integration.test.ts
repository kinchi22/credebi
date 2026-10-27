import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  isErr,
  isOk,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase } from '@repo/db';
import {
  startingChart,
  type Account,
  type Chart,
  type StartingChartCopy,
} from '../../accounts/domain/account';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { DEFAULT_SETTINGS, type Settings } from '../../settings/domain/settings';
import { type Identity, type User } from '../domain/user';
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

const repository = createPostgresUserRepository(databaseUrl, logger);
const dead = createPostgresUserRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

beforeEach(async () => {
  await database.execute(sql`truncate table users cascade`);
  logged.length = 0;
});

const ADA: User = {
  id: '01920000-0000-7000-8000-000000000001' as UserId,
  email: 'ada@example.com',
  name: 'Ada',
  createdAt: new Date('2026-09-18T09:30:00.123+09:00'),
};
const GOOGLE_ADA: Identity = { provider: 'google', subject: 'google-ada' };

async function found(identity: Identity): Promise<User | undefined> {
  const result = await repository.findByIdentity(identity);
  expect(isOk(result)).toBe(true);
  return isOk(result) ? result.value : undefined;
}

const CASH: Account = {
  id: '01920000-0000-7000-8000-00000000c001' as AccountId,
  accountType: 'asset',
  groupId: null,
  name: 'Cash',
  description: null,
  position: 0,
  activeFrom: '2026-09-18',
  activeUntil: null,
};
const EXPENSES: Account = {
  ...CASH,
  id: '01920000-0000-7000-8000-00000000c005' as AccountId,
  accountType: 'expense',
  name: 'Expenses',
};

const NO_CHART: Chart = { accounts: [], groups: [] };
const only = (...accounts: readonly Account[]): Chart => ({ accounts, groups: [] });

const STARTING_COPY: StartingChartCopy = {
  cashAndDeposits: { name: 'Cash and deposits', description: 'Cash and bank deposits together' },
  cash: { name: 'Cash', description: 'Cash in a wallet' },
  bankDeposits: { name: 'Bank deposits', description: 'Money in bank accounts' },
  creditCardPayable: { name: 'Credit card payable', description: 'Card spending not yet repaid' },
  openingBalanceEquity: { name: 'Opening balance equity', description: 'Net worth at the start' },
  salary: { name: 'Salary', description: 'Pay for work' },
  livingExpenses: { name: 'Living expenses', description: 'Everyday spending together' },
  food: { name: 'Food', description: 'Groceries and eating out' },
  transportation: { name: 'Transportation', description: 'Getting around' },
  otherLivingExpenses: { name: 'Other living expenses', description: 'Everything else' },
};

function chartFor(prefix: string, copy: StartingChartCopy = STARTING_COPY): Chart {
  let issued = 0;
  const next = (): string => {
    issued += 1;
    return `01920000-0000-7000-8000-${prefix}${String(issued).padStart(12 - prefix.length, '0')}`;
  };
  return startingChart('2000-01-01', copy, {
    newAccountId: () => next() as AccountId,
    newAccountGroupId: () => next() as AccountGroupId,
  });
}

async function storedGroups(): Promise<readonly Record<string, unknown>[]> {
  const result = await database.execute(
    sql`select id, user_id, account_type, name, description, position
        from account_groups order by id`,
  );
  return result.rows;
}

async function storedAccounts(): Promise<readonly Record<string, unknown>[]> {
  const result = await database.execute(
    sql`select id, user_id, account_type, name, description, position, group_id,
               active_from::text as active_from, active_until::text as active_until
        from accounts order by id`,
  );
  return result.rows;
}

async function storedSettings(): Promise<readonly Record<string, unknown>[]> {
  const result = await database.execute(
    sql`select user_id, entry_form_mode, language from user_settings order by user_id`,
  );
  return result.rows;
}

async function countUsers(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from users`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresUserRepository', () => {
  it('finds a User by the Identity they were added with, as they were added', async () => {
    expect(isOk(await repository.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS))).toBe(true);

    expect(await found(GOOGLE_ADA)).toEqual(ADA);
    expect(logged).toEqual([]);
  });

  it('keeps a User with no name', async () => {
    const nameless = { ...ADA, name: null };
    await repository.add(nameless, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);

    expect(await found(GOOGLE_ADA)).toEqual(nameless);
  });

  it('finds nobody by an Identity nobody has', async () => {
    await repository.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);

    expect(await found({ provider: 'google', subject: 'google-grace' })).toBeUndefined();
  });

  it('keys an Identity by its provider too, so the same subject elsewhere is someone else', async () => {
    await repository.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);

    expect(await found({ provider: 'test', subject: 'google-ada' })).toBeUndefined();
  });

  it('refuses an Identity that already has a User as a conflict, and stores nobody', async () => {
    await repository.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);
    const second: User = {
      ...ADA,
      id: '01920000-0000-7000-8000-000000000002' as UserId,
    };

    const result = await repository.add(second, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);

    expect(isErr(result) && result.error.code).toBe('CONFLICT');
    expect(await countUsers()).toBe(1);
    expect(await found(GOOGLE_ADA)).toEqual(ADA);
    expect(logged).toEqual([]);
  });

  it('stores a new User together with its chart of accounts', async () => {
    expect(isOk(await repository.add(ADA, GOOGLE_ADA, only(CASH, EXPENSES), DEFAULT_SETTINGS))).toBe(true);

    expect(await storedAccounts()).toEqual(
      [CASH, EXPENSES].map((account) => ({
        id: account.id,
        user_id: ADA.id,
        account_type: account.accountType,
        name: account.name,
        description: null,
        position: 0,
        group_id: null,
        active_from: '2026-09-18',
        active_until: null,
      })),
    );
  });

  it.each(['en', 'ko', 'ja'] as const)(
    'stores a new User together with their Settings, %s as their Language',
    async (language) => {
      const settings: Settings = { entryFormMode: 'multi-line', language };

      expect(isOk(await repository.add(ADA, GOOGLE_ADA, only(CASH), settings))).toBe(true);

      expect(await storedSettings()).toEqual([
        { user_id: ADA.id, entry_form_mode: 'multi-line', language },
      ]);
    },
  );

  it('stores the starting chart as the User\'s own, its Accounts in their Account groups, described and in order', async () => {
    const chart = chartFor('a');

    expect(isOk(await repository.add(ADA, GOOGLE_ADA, chart, DEFAULT_SETTINGS))).toBe(true);

    const groups = await storedGroups();
    expect(groups).toEqual([
      {
        id: chart.groups[0]?.id,
        user_id: ADA.id,
        account_type: 'asset',
        name: 'Cash and deposits',
        description: 'Cash and bank deposits together',
        position: 0,
      },
      {
        id: chart.groups[1]?.id,
        user_id: ADA.id,
        account_type: 'expense',
        name: 'Living expenses',
        description: 'Everyday spending together',
        position: 0,
      },
    ]);
    const groupName = new Map(groups.map((group) => [group['id'], group['name']]));
    expect(
      (await storedAccounts()).map((row) => [
        row['user_id'],
        row['account_type'],
        groupName.get(row['group_id']) ?? null,
        row['position'],
        row['name'],
        row['description'],
        row['active_from'],
        row['active_until'],
      ]),
    ).toEqual([
      [ADA.id, 'asset', 'Cash and deposits', 0, 'Cash', 'Cash in a wallet', '2000-01-01', null],
      [ADA.id, 'asset', 'Cash and deposits', 1, 'Bank deposits', 'Money in bank accounts', '2000-01-01', null],
      [ADA.id, 'liability', null, 0, 'Credit card payable', 'Card spending not yet repaid', '2000-01-01', null],
      [ADA.id, 'equity', null, 0, 'Opening balance equity', 'Net worth at the start', '2000-01-01', null],
      [ADA.id, 'revenue', null, 0, 'Salary', 'Pay for work', '2000-01-01', null],
      [ADA.id, 'expense', 'Living expenses', 0, 'Food', 'Groceries and eating out', '2000-01-01', null],
      [ADA.id, 'expense', 'Living expenses', 1, 'Transportation', 'Getting around', '2000-01-01', null],
      [ADA.id, 'expense', 'Living expenses', 2, 'Other living expenses', 'Everything else', '2000-01-01', null],
    ]);
  });

  it('gives each User a starting chart of their own', async () => {
    const grace: User = { ...ADA, id: '01920000-0000-7000-8000-000000000002' as UserId };

    await repository.add(ADA, GOOGLE_ADA, chartFor('a'), DEFAULT_SETTINGS);
    await repository.add(grace, { provider: 'google', subject: 'google-grace' }, chartFor('b'), DEFAULT_SETTINGS);

    const owners = async (table: 'accounts' | 'account_groups'): Promise<readonly unknown[]> =>
      (
        await database.execute(
          sql`select user_id, count(*)::int as count from ${sql.identifier(table)} group by user_id order by user_id`,
        )
      ).rows;
    expect(await owners('account_groups')).toEqual([
      { user_id: ADA.id, count: 2 },
      { user_id: grace.id, count: 2 },
    ]);
    expect(await owners('accounts')).toEqual([
      { user_id: ADA.id, count: 8 },
      { user_id: grace.id, count: 8 },
    ]);
  });

  it("leaves an existing User's previous five Accounts and their Entries as they were when another User starts", async () => {
    const previous = only(
      ...(
        [
          ['asset', 'Cash'],
          ['liability', 'Accounts payable'],
          ['equity', 'Capital'],
          ['revenue', 'Sales'],
          ['expense', 'Expenses'],
        ] as const
      ).map(([accountType, name], n): Account => ({
        ...CASH,
        id: `01920000-0000-7000-8000-00000000e00${String(n)}` as AccountId,
        accountType,
        name,
      })),
    );
    await repository.add(ADA, GOOGLE_ADA, previous, DEFAULT_SETTINGS);
    await database.execute(
      sql`insert into entries (id, entry_date, memo, created_at, user_id)
          values ('01920000-0000-7000-8000-00000000f001', '2026-09-18', '', now(), ${ADA.id})`,
    );
    await database.execute(
      sql`insert into entry_lines (entry_id, line_number, account_id, side, amount) values
          ('01920000-0000-7000-8000-00000000f001', 1, '01920000-0000-7000-8000-00000000e004', 'debit', 1200),
          ('01920000-0000-7000-8000-00000000f001', 2, '01920000-0000-7000-8000-00000000e000', 'credit', 1200)`,
    );
    const entryLines = async (): Promise<readonly unknown[]> =>
      (await database.execute(sql`select * from entry_lines order by line_number`)).rows;
    const accountsBefore = await storedAccounts();
    const linesBefore = await entryLines();

    await repository.updateProfile(ADA.id, { email: 'ada@lovelace.test', name: 'Ada' });
    await repository.add(
      { ...ADA, id: '01920000-0000-7000-8000-000000000002' as UserId },
      { provider: 'google', subject: 'google-grace' },
      chartFor('a'),
      DEFAULT_SETTINGS,
    );

    expect((await storedAccounts()).filter((row) => row['user_id'] === ADA.id)).toEqual(accountsBefore);
    expect(accountsBefore.map((row) => row['name'])).toEqual([
      'Cash',
      'Accounts payable',
      'Capital',
      'Sales',
      'Expenses',
    ]);
    expect((await storedGroups()).filter((row) => row['user_id'] === ADA.id)).toEqual([]);
    expect(await entryLines()).toEqual(linesBefore);
    expect(linesBefore).toHaveLength(2);
  });

  it('stores no User, Identity, Settings, Account group or Account when the starting chart cannot be stored', async () => {
    const clashing = chartFor('a', {
      ...STARTING_COPY,
      transportation: { name: 'Food', description: 'A second Account named Food' },
    });

    const result = await repository.add(ADA, GOOGLE_ADA, clashing, DEFAULT_SETTINGS);

    expect(isErr(result)).toBe(true);
    expect(await countUsers()).toBe(0);
    expect(await found(GOOGLE_ADA)).toBeUndefined();
    expect(await storedSettings()).toEqual([]);
    expect(await storedGroups()).toEqual([]);
    expect(await storedAccounts()).toEqual([]);
  });

  it('stores neither the User nor its chart when either cannot be stored', async () => {
    await repository.add(ADA, GOOGLE_ADA, only(CASH), DEFAULT_SETTINGS);
    const second: User = { ...ADA, id: '01920000-0000-7000-8000-000000000002' as UserId };
    const third: User = { ...ADA, id: '01920000-0000-7000-8000-000000000003' as UserId };

    const conflicting = await repository.add(second, GOOGLE_ADA, only(EXPENSES), DEFAULT_SETTINGS);
    const clashing = await repository.add(
      third,
      { provider: 'google', subject: 'google-third' },
      only(CASH),
      DEFAULT_SETTINGS,
    );

    expect(isErr(conflicting) && conflicting.error.code).toBe('CONFLICT');
    expect(isErr(clashing)).toBe(true);
    expect(await countUsers()).toBe(1);
    expect((await storedAccounts()).map((row) => row['id'])).toEqual([CASH.id]);
    expect(await storedSettings()).toEqual([{ user_id: ADA.id, entry_form_mode: 'two-line', language: 'en' }]);
  });

  it('records the email and name of the latest sign-in', async () => {
    await repository.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);

    const result = await repository.updateProfile(ADA.id, {
      email: 'ada@lovelace.test',
      name: null,
    });

    expect(isOk(result)).toBe(true);
    expect(await found(GOOGLE_ADA)).toEqual({
      ...ADA,
      email: 'ada@lovelace.test',
      name: null,
    });
  });

  it('reports an unreachable database as a result on every path, never by throwing', async () => {
    const find = await dead.findByIdentity(GOOGLE_ADA);
    const add = await dead.add(ADA, GOOGLE_ADA, NO_CHART, DEFAULT_SETTINGS);
    const update = await dead.updateProfile(ADA.id, {
      email: 'ada@example.com',
      name: null,
    });

    const results: readonly Result<unknown, DomainError>[] = [find, add, update];
    for (const result of results) {
      expect(isErr(result) && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.find_user_failed',
      'auth.add_user_failed',
      'auth.update_profile_failed',
    ]);
    expect(logged.map((fields) => fields['error'])).toEqual([
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
    ]);
    expect(JSON.stringify(logged)).not.toContain('ada@example.com');
  });
});
