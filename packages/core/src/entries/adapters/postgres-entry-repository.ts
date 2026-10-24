import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  getTableColumns,
  sql,
  type SQL,
} from 'drizzle-orm';
import { type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { QueryBuilder, type PgDatabase } from 'drizzle-orm/pg-core';
import {
  domainError,
  err,
  ok,
  sideSchema,
  type AccountId,
  type DomainError,
  type EntryId,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema, type Schema } from '@repo/db';
import { type NamedAccount } from '../../accounts/domain/account';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { money, MONEY_ZERO } from '../../money/domain/money';
import { makeEntry, notInChart, type Entry, type EntryDraft } from '../domain/entry';
import { type AccountSums } from '../domain/income-statement';
import { type TitledEntry, type TitledLine } from '../domain/offered-titles';
import { type SearchCriteria } from '../domain/search-criteria';
import { type DayRange } from '../domain/search-range';
import { reversedAlready, type Reversal } from '../domain/reversal';
import { reversed, shownEntry } from './shown-entry';
import { type EntryRepository, type FoundEntry } from '../ports/entry-repository';

export type PostgresEntryRepository = EntryRepository & {
  readonly close: () => Promise<void>;
};

export type PostgresExecutor = PgDatabase<NodePgQueryResultHKT, Schema>;

type EntryRow = typeof schema.entries.$inferSelect;
type LineRow = {
  readonly entryId: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly side: string;
  readonly amount: number;
};

const LINE_COLUMNS = {
  entryId: schema.entryLines.entryId,
  accountId: schema.accounts.id,
  accountName: schema.accounts.name,
  side: schema.entryLines.side,
  amount: schema.entryLines.amount,
};

export function createPostgresEntryRepository(
  connectionString: string,
  logger: Logger,
): PostgresEntryRepository {
  const { database, close } = createDatabase(connectionString);
  return { ...postgresEntriesOn(database, logger), close };
}

export function postgresEntriesOn(database: PostgresExecutor, logger: Logger): EntryRepository {
  const insert = async (
    transaction: PostgresExecutor,
    userId: UserId,
    entry: Entry,
    reverses: EntryId | null,
  ): Promise<void> => {
    await transaction.insert(schema.entries).values({
      id: entry.id,
      userId,
      entryDate: entry.entryDate,
      title: entry.title,
      memo: entry.memo,
      createdAt: entry.createdAt,
      reversesEntryId: reverses,
    });
    await transaction.insert(schema.entryLines).values(
      entry.lines.map((line, index) => ({
        entryId: entry.id,
        lineNumber: index + 1,
        accountId: line.account,
        side: line.side,
        amount: line.amount,
      })),
    );
  };

  const unheldAccount = async (
    transaction: PostgresExecutor,
    entry: Entry,
  ): Promise<AccountId | undefined> => {
    const named = [...new Set(entry.lines.map((line) => line.account))].toSorted();
    const held = await transaction
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(
        and(
          inArray(schema.accounts.id, named),
          isNull(schema.accounts.removedAt),
        ),
      )
      .orderBy(asc(schema.accounts.id))
      .for('share');
    const heldIds = new Set<string>(held.map((row) => row.id));
    return named.find((account) => !heldIds.has(account));
  };

  const logSaveFailed = (entry: Entry, error: unknown, message: string): void => {
    logger.error(
      { event: 'entries.save_failed', entryId: entry.id, error: describeError(error) },
      message,
    );
  };

  const restoreOrReport = (
    row: EntryRow,
    lineRows: readonly LineRow[],
  ): Result<Entry, DomainError> => {
    const entry = restore(row, lineRows);
    if (!entry.ok) {
      logger.error(
        { event: 'entries.stored_entry_invalid', entryId: row.id, reason: entry.error.message },
        'A stored entry breaks a rule, so the read did not answer.',
      );
    }
    return entry;
  };

  return {
    save: async (userId: UserId, entry: Entry): Promise<Result<void, DomainError>> => {
      try {
        const unheld = await database.transaction(async (transaction) => {
          const account = await unheldAccount(transaction, entry);
          if (account === undefined) {
            await insert(transaction, userId, entry, null);
          }
          return account;
        });
        return unheld === undefined ? ok(undefined) : notInChart(unheld);
      } catch (error) {
        logSaveFailed(entry, error, 'An entry could not be stored.');
        return unavailable('The entry could not be stored.');
      }
    },

    saveReversal: async (
      userId: UserId,
      reversal: Reversal,
    ): Promise<Result<void, DomainError>> => {
      try {
        await database.transaction((transaction) =>
          insert(transaction, userId, reversal, reversal.reverses),
        );
        return ok(undefined);
      } catch (error) {
        if (violates(error, REVERSED_ONCE)) {
          return reversedAlready(reversal.reverses);
        }
        logSaveFailed(reversal, error, 'A reversal could not be stored.');
        return unavailable('The reversal could not be stored.');
      }
    },

    find: async (userId: UserId, id: EntryId): Promise<Result<FoundEntry, DomainError>> => {
      let entryRows: (EntryRow & { readonly reversed: boolean })[];
      let lineRows: LineRow[];
      try {
        entryRows = await database
          .select({
            ...getTableColumns(schema.entries),
            reversed: reversed(schema.entries.id).mapWith(Boolean),
          })
          .from(schema.entries)
          .where(
            and(
              eq(schema.entries.id, id),
              eq(schema.entries.userId, userId),
              isNull(schema.entries.reversesEntryId),
            ),
          );
        lineRows = await database
          .select(LINE_COLUMNS)
          .from(schema.entryLines)
          .innerJoin(schema.accounts, eq(schema.accounts.id, schema.entryLines.accountId))
          .where(eq(schema.entryLines.entryId, id))
          .orderBy(asc(schema.entryLines.lineNumber));
      } catch (error) {
        logger.error(
          { event: 'entries.find_failed', entryId: id, error: describeError(error) },
          'An entry could not be read.',
        );
        return unavailable('The entry could not be read.');
      }

      const [row] = entryRows;
      if (row === undefined) {
        return err(domainError('NOT_FOUND', `No entry ${id} is visible to this User.`));
      }
      const entry = restoreOrReport(row, lineRows);
      if (!entry.ok) {
        return entry;
      }
      return ok({ entry: entry.value, reversed: row.reversed });
    },

    search: async (
      userId: UserId,
      criteria: SearchCriteria,
    ): Promise<Result<readonly Entry[], DomainError>> => {
      const matching = matches(userId, criteria);
      let entryRows: EntryRow[];
      let lineRows: LineRow[];
      try {
        entryRows = await database
          .select()
          .from(schema.entries)
          .where(matching)
          .orderBy(
            desc(schema.entries.entryDate),
            desc(schema.entries.createdAt),
            desc(schema.entries.id),
          );
        lineRows = await database
          .select(LINE_COLUMNS)
          .from(schema.entryLines)
          .innerJoin(schema.entries, eq(schema.entries.id, schema.entryLines.entryId))
          .innerJoin(schema.accounts, eq(schema.accounts.id, schema.entryLines.accountId))
          .where(matching)
          .orderBy(asc(schema.entryLines.entryId), asc(schema.entryLines.lineNumber));
      } catch (error) {
        logger.error(
          { event: 'entries.search_failed', error: describeError(error) },
          'The entries could not be read.',
        );
        return unavailable('The entries could not be read.');
      }

      const linesByEntry = new Map<string, LineRow[]>();
      for (const line of lineRows) {
        const lines = linesByEntry.get(line.entryId) ?? [];
        lines.push(line);
        linesByEntry.set(line.entryId, lines);
      }

      const entries: Entry[] = [];
      for (const row of entryRows) {
        const entry = restoreOrReport(row, linesByEntry.get(row.id) ?? []);
        if (!entry.ok) {
          return entry;
        }
        entries.push(entry.value);
      }
      return ok(entries);
    },

    accountTotals: async (
      userId: UserId,
      range: DayRange,
    ): Promise<Result<readonly AccountSums[], DomainError>> => {
      let rows: { readonly accountId: string; readonly side: string; readonly amount: string }[];
      try {
        rows = await database
          .select({
            accountId: schema.entryLines.accountId,
            side: schema.entryLines.side,
            amount: sql<string>`sum(${schema.entryLines.amount})::text`,
          })
          .from(schema.entryLines)
          .innerJoin(schema.entries, eq(schema.entries.id, schema.entryLines.entryId))
          .where(
            and(
              eq(schema.entries.userId, userId),
              shownEntry(),
              gte(schema.entries.entryDate, range.from),
              lte(schema.entries.entryDate, range.to),
            ),
          )
          .groupBy(schema.entryLines.accountId, schema.entryLines.side)
          .orderBy(asc(schema.entryLines.accountId), asc(schema.entryLines.side));
      } catch (error) {
        logger.error(
          { event: 'entries.account_totals_failed', error: describeError(error) },
          'The Account totals could not be read.',
        );
        return unavailable('The Account totals could not be read.');
      }

      const totals = new Map<AccountId, AccountSums>();
      for (const row of rows) {
        const account = row.accountId as AccountId;
        const side = sideSchema.safeParse(row.side);
        const amount = money(Number(row.amount));
        if (!side.success || !amount.ok) {
          return unavailable(`Account ${account} sums to no valid amount on a valid side.`);
        }
        const held = totals.get(account) ?? { account, debit: MONEY_ZERO, credit: MONEY_ZERO };
        totals.set(account, { ...held, [side.data]: amount.value });
      }
      return ok([...totals.values()]);
    },

    titledEntries: async (
      userId: UserId,
      createdSince: Date,
    ): Promise<Result<readonly TitledEntry[], DomainError>> => {
      const titled = and(
        eq(schema.entries.userId, userId),
        shownEntry(),
        ne(schema.entries.title, ''),
        gte(schema.entries.createdAt, createdSince),
      );
      let entryRows: Pick<EntryRow, 'id' | 'title' | 'createdAt'>[];
      let lineRows: Omit<LineRow, 'accountName'>[];
      try {
        entryRows = await database
          .select({
            id: schema.entries.id,
            title: schema.entries.title,
            createdAt: schema.entries.createdAt,
          })
          .from(schema.entries)
          .where(titled);
        lineRows = await database
          .select({
            entryId: schema.entryLines.entryId,
            accountId: schema.entryLines.accountId,
            side: schema.entryLines.side,
            amount: schema.entryLines.amount,
          })
          .from(schema.entryLines)
          .innerJoin(schema.entries, eq(schema.entries.id, schema.entryLines.entryId))
          .where(titled)
          .orderBy(asc(schema.entryLines.entryId), asc(schema.entryLines.lineNumber));
      } catch (error) {
        logger.error(
          { event: 'entries.titles_failed', error: describeError(error) },
          'The Titles could not be read.',
        );
        return unavailable('The Titles could not be read.');
      }

      const linesByEntry = new Map<string, TitledLine[]>();
      for (const line of lineRows) {
        const side = sideSchema.safeParse(line.side);
        const amount = money(line.amount);
        if (!side.success || !amount.ok) {
          return unavailable(`Stored entry ${line.entryId} has a line with no valid side or amount.`);
        }
        const lines = linesByEntry.get(line.entryId) ?? [];
        lines.push({ account: line.accountId as AccountId, side: side.data, amount: amount.value });
        linesByEntry.set(line.entryId, lines);
      }
      return ok(
        entryRows.map((row) => ({
          id: row.id as EntryId,
          title: row.title,
          createdAt: row.createdAt,
          lines: linesByEntry.get(row.id) ?? [],
        })),
      );
    },
  };
}

const unavailable = (message: string): Err<DomainError> =>
  err(domainError('DEPENDENCY_UNAVAILABLE', message));

const REVERSED_ONCE = 'entries_reverses_entry_id_unique';

function violates(thrown: unknown, constraint: string): boolean {
  let current: unknown = thrown;
  while (current instanceof Error) {
    if (Reflect.get(current, 'constraint') === constraint) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function matches(userId: UserId, criteria: SearchCriteria): SQL | undefined {
  return and(
    eq(schema.entries.userId, userId),
    shownEntry(),
    ...(criteria.from === undefined ? [] : [gte(schema.entries.entryDate, criteria.from)]),
    ...(criteria.to === undefined ? [] : [lte(schema.entries.entryDate, criteria.to)]),
    ...(criteria.account === undefined ? [] : [touches(criteria.account)]),
    ...(criteria.title === undefined ? [] : [eq(foldedTitle(), sql`lower(${criteria.title})`)]),
    ...(criteria.memo === undefined ? [] : [ilike(schema.entries.memo, containing(criteria.memo))]),
  );
}

function foldedTitle(): SQL {
  return sql`lower(${schema.entries.title})`;
}

const LIKE_ESCAPE = '\\';

const LIKE_SPECIAL = new Set([LIKE_ESCAPE, '%', '_']);

function containing(term: string): string {
  let literal = '';
  for (const character of term) {
    literal += LIKE_SPECIAL.has(character) ? `${LIKE_ESCAPE}${character}` : character;
  }
  return `%${literal}%`;
}

function touches(account: AccountId): SQL {
  return exists(
    new QueryBuilder()
      .select({ entryId: schema.entryLines.entryId })
      .from(schema.entryLines)
      .where(
        and(
          eq(schema.entryLines.entryId, schema.entries.id),
          eq(schema.entryLines.accountId, account),
        ),
      ),
  );
}

function restore(row: EntryRow, lineRows: readonly LineRow[]): Result<Entry, DomainError> {
  const lines: EntryDraft['lines'][number][] = [];
  const names = new Map<string, NamedAccount>();
  for (const line of lineRows) {
    const side = sideSchema.safeParse(line.side);
    const amount = money(line.amount);
    if (!side.success || !amount.ok) {
      return unavailable(`Stored entry ${row.id} has a line with no valid side or amount.`);
    }
    const account = line.accountId as AccountId;
    names.set(account, { id: account, name: line.accountName });
    lines.push({ account, side: side.data, amount: amount.value });
  }

  const entry = makeEntry(
    { entryDate: row.entryDate, title: row.title, memo: row.memo, lines },
    { id: row.id as EntryId, createdAt: row.createdAt },
    names,
  );
  return entry.ok
    ? entry
    : unavailable(`Stored entry ${row.id} breaks a rule: ${entry.error.message}`);
}
