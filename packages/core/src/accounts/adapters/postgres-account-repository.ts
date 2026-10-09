import { and, asc, eq } from 'drizzle-orm';
import {
  accountTypeSchema,
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { databaseFailure, UNIQUE_VIOLATION } from '../../auth/adapters/database-failure';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type Account } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type PostgresAccountRepository = AccountRepository & {
  readonly close: () => Promise<void>;
};

type AccountRow = Omit<typeof schema.accounts.$inferSelect, 'userId' | 'groupId'>;

export function createPostgresAccountRepository(
  connectionString: string,
  logger: Logger,
): PostgresAccountRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    readChart: async (userId: UserId): Promise<Result<readonly Account[], DomainError>> => {
      let rows: AccountRow[];
      try {
        rows = await database
          .select({
            id: schema.accounts.id,
            accountType: schema.accounts.accountType,
            name: schema.accounts.name,
            description: schema.accounts.description,
            position: schema.accounts.position,
            activeFrom: schema.accounts.activeFrom,
            activeUntil: schema.accounts.activeUntil,
          })
          .from(schema.accounts)
          .where(eq(schema.accounts.userId, userId))
          .orderBy(asc(schema.accounts.position), asc(schema.accounts.id));
      } catch (error) {
        return databaseFailure(
          logger,
          'accounts.read_failed',
          error,
          'The chart of accounts could not be read.',
        );
      }

      const chart: Account[] = [];
      for (const row of rows) {
        const accountType = accountTypeSchema.safeParse(row.accountType);
        if (!accountType.success) {
          logger.error(
            { event: 'accounts.stored_account_invalid', accountId: row.id },
            'A stored Account has no valid Account type, so the chart was not read.',
          );
          return err(
            domainError('DEPENDENCY_UNAVAILABLE', `Stored Account ${row.id} has no valid Account type.`),
          );
        }
        chart.push({ ...row, id: row.id as AccountId, accountType: accountType.data });
      }
      return ok(chart);
    },

    addAccount: async (userId: UserId, account: Account): Promise<Result<void, DomainError>> => {
      try {
        await database.insert(schema.accounts).values({ ...account, userId });
        return ok(undefined);
      } catch (error) {
        return saveFailure(logger, 'accounts.add_failed', error, account);
      }
    },

    updateAccount: async (userId: UserId, account: Account): Promise<Result<void, DomainError>> => {
      let updated: { readonly id: string }[];
      try {
        updated = await database
          .update(schema.accounts)
          .set({
            name: account.name,
            description: account.description,
            activeFrom: account.activeFrom,
            activeUntil: account.activeUntil,
          })
          .where(and(eq(schema.accounts.id, account.id), eq(schema.accounts.userId, userId)))
          .returning({ id: schema.accounts.id });
      } catch (error) {
        return saveFailure(logger, 'accounts.update_failed', error, account);
      }
      return updated.length === 0
        ? err(domainError('NOT_FOUND', `Account ${account.id} is not in the User's chart of accounts.`))
        : ok(undefined);
    },

    close,
  };
}

function saveFailure(
  logger: Logger,
  event: string,
  error: unknown,
  account: Account,
): Err<DomainError> {
  if (describeError(error).code === UNIQUE_VIOLATION) {
    return err(domainError('NAME_TAKEN', `Another Account is named "${account.name}".`));
  }
  return databaseFailure(logger, event, error, 'The Account could not be saved.');
}
