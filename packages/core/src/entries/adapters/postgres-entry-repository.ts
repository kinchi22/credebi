import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  isNull,
  lte,
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
import { money } from '../../money/domain/money';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { type SearchCriteria } from '../domain/search-criteria';
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

function legacyAccountCodeFor(account: AccountId): SQL {
  return sql`(select case ${schema.accounts.accountType}
      when 'asset' then 'cash'
      when 'liability' then 'payable'
      when 'equity' then 'capital'
      when 'revenue' then 'sales'
      when 'expense' then 'expense'
    end from ${schema.accounts} where ${schema.accounts.id} = ${account})`;
}

export function createPostgresEntryRepository(
  connectionString: string,
  logger: Logger,
): PostgresEntryRepository {
  const { database, close } = createDatabase(connectionString);
  return { ...postgresEntriesOn(database, logger), close };
}

export function postgresEntriesOn(database: PostgresExecutor, logger: Logger): EntryRepository {
  const insert = (userId: UserId, entry: Entry, reverses: EntryId | null): Promise<void> =>
    database.transaction(async (transaction) => {
      await transaction.insert(schema.entries).values({
        id: entry.id,
        userId,
        entryDate: entry.entryDate,
        memo: entry.memo,
        createdAt: entry.createdAt,
        reversesEntryId: reverses,
      });
      await transaction.insert(schema.entryLines).values(
        entry.lines.map((line, index) => ({
          entryId: entry.id,
          lineNumber: index + 1,
          account: legacyAccountCodeFor(line.account),
          accountId: line.account,
          side: line.side,
          amount: line.amount,
        })),
      );
    });

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
        await insert(userId, entry, null);
        return ok(undefined);
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
        await insert(userId, reversal, reversal.reverses);
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
    ...(criteria.memo === undefined ? [] : [ilike(schema.entries.memo, containing(criteria.memo))]),
  );
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
    { entryDate: row.entryDate, memo: row.memo, lines },
    { id: row.id as EntryId, createdAt: row.createdAt },
    names,
  );
  return entry.ok
    ? entry
    : unavailable(`Stored entry ${row.id} breaks a rule: ${entry.error.message}`);
}
