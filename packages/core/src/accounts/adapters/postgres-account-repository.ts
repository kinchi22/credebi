import { asc, eq } from 'drizzle-orm';
import {
  accountTypeSchema,
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { databaseFailure } from '../../auth/adapters/database-failure';
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

    close,
  };
}
