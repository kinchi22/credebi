import { and, asc, eq } from 'drizzle-orm';
import {
  accountTypeSchema,
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type DomainError,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { databaseFailure, UNIQUE_VIOLATION } from '../../auth/adapters/database-failure';
import { describeError } from '../../logging/domain/describe-error';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type PostgresAccountRepository = AccountRepository & {
  readonly close: () => Promise<void>;
};

type AccountRow = Omit<typeof schema.accounts.$inferSelect, 'userId'>;

type GroupRow = Omit<typeof schema.accountGroups.$inferSelect, 'userId'>;

const FOREIGN_KEY_VIOLATION = '23503';

export function createPostgresAccountRepository(
  connectionString: string,
  logger: Logger,
): PostgresAccountRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    readChart: async (userId: UserId): Promise<Result<Chart, DomainError>> => {
      let rows: { readonly accounts: AccountRow[]; readonly groups: GroupRow[] };
      try {
        const [accounts, groups] = await Promise.all([
          database
            .select({
              id: schema.accounts.id,
              accountType: schema.accounts.accountType,
              groupId: schema.accounts.groupId,
              name: schema.accounts.name,
              description: schema.accounts.description,
              position: schema.accounts.position,
              activeFrom: schema.accounts.activeFrom,
              activeUntil: schema.accounts.activeUntil,
            })
            .from(schema.accounts)
            .where(eq(schema.accounts.userId, userId))
            .orderBy(asc(schema.accounts.position), asc(schema.accounts.id)),
          database
            .select({
              id: schema.accountGroups.id,
              accountType: schema.accountGroups.accountType,
              name: schema.accountGroups.name,
              description: schema.accountGroups.description,
              position: schema.accountGroups.position,
            })
            .from(schema.accountGroups)
            .where(eq(schema.accountGroups.userId, userId))
            .orderBy(asc(schema.accountGroups.position), asc(schema.accountGroups.id)),
        ]);
        rows = { accounts, groups };
      } catch (error) {
        return databaseFailure(
          logger,
          'accounts.read_failed',
          error,
          'The chart of accounts could not be read.',
        );
      }

      const accounts: Account[] = [];
      for (const row of rows.accounts) {
        const accountType = storedAccountType(logger, row.accountType, {
          event: 'accounts.stored_account_invalid',
          accountId: row.id,
        });
        if (!accountType.ok) {
          return accountType;
        }
        accounts.push({
          ...row,
          id: row.id as AccountId,
          accountType: accountType.value,
          groupId: row.groupId as AccountGroupId | null,
        });
      }

      const groups: AccountGroup[] = [];
      for (const row of rows.groups) {
        const accountType = storedAccountType(logger, row.accountType, {
          event: 'accounts.stored_group_invalid',
          accountGroupId: row.id,
        });
        if (!accountType.ok) {
          return accountType;
        }
        groups.push({ ...row, id: row.id as AccountGroupId, accountType: accountType.value });
      }

      return ok({ accounts, groups });
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
            groupId: account.groupId,
            name: account.name,
            description: account.description,
            position: account.position,
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

    addGroup: async (userId: UserId, group: AccountGroup): Promise<Result<void, DomainError>> => {
      try {
        await database.insert(schema.accountGroups).values({ ...group, userId });
        return ok(undefined);
      } catch (error) {
        return groupSaveFailure(logger, 'accounts.add_group_failed', error, group);
      }
    },

    updateGroup: async (userId: UserId, group: AccountGroup): Promise<Result<void, DomainError>> => {
      let updated: { readonly id: string }[];
      try {
        updated = await database
          .update(schema.accountGroups)
          .set({ name: group.name, description: group.description })
          .where(and(eq(schema.accountGroups.id, group.id), eq(schema.accountGroups.userId, userId)))
          .returning({ id: schema.accountGroups.id });
      } catch (error) {
        return groupSaveFailure(logger, 'accounts.update_group_failed', error, group);
      }
      return updated.length === 0
        ? err(
            domainError('NOT_FOUND', `Account group ${group.id} is not in the User's chart of accounts.`),
          )
        : ok(undefined);
    },

    isAccountNamed: async (userId: UserId, id: AccountId): Promise<Result<boolean, DomainError>> => {
      try {
        const naming = await database
          .select({ entryId: schema.entryLines.entryId })
          .from(schema.entryLines)
          .innerJoin(schema.accounts, eq(schema.accounts.id, schema.entryLines.accountId))
          .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)))
          .limit(1);
        return ok(naming.length > 0);
      } catch (error) {
        return databaseFailure(
          logger,
          'accounts.named_read_failed',
          error,
          'Whether an Entry names the Account could not be read.',
        );
      }
    },

    deleteAccount: async (userId: UserId, id: AccountId): Promise<Result<void, DomainError>> => {
      let deleted: { readonly id: string }[];
      try {
        deleted = await database
          .delete(schema.accounts)
          .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)))
          .returning({ id: schema.accounts.id });
      } catch (error) {
        return deleteFailure(
          logger,
          'accounts.delete_failed',
          error,
          `An Entry names Account ${id}, so it cannot be deleted.`,
          'The Account could not be deleted.',
        );
      }
      return deleted.length === 0
        ? err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`))
        : ok(undefined);
    },

    deleteGroup: async (userId: UserId, id: AccountGroupId): Promise<Result<void, DomainError>> => {
      let deleted: { readonly id: string }[];
      try {
        deleted = await database
          .delete(schema.accountGroups)
          .where(and(eq(schema.accountGroups.id, id), eq(schema.accountGroups.userId, userId)))
          .returning({ id: schema.accountGroups.id });
      } catch (error) {
        return deleteFailure(
          logger,
          'accounts.delete_group_failed',
          error,
          `Account group ${id} holds Accounts, so it cannot be deleted.`,
          'The Account group could not be deleted.',
        );
      }
      return deleted.length === 0
        ? err(domainError('NOT_FOUND', `Account group ${id} is not in the User's chart of accounts.`))
        : ok(undefined);
    },

    close,
  };
}

function storedAccountType(
  logger: Logger,
  stored: string,
  fields: LogFields,
): Result<AccountType, DomainError> {
  const accountType = accountTypeSchema.safeParse(stored);
  if (accountType.success) {
    return ok(accountType.data);
  }
  logger.error(
    fields,
    'A stored Account or Account group has no valid Account type, so the chart was not read.',
  );
  return err(
    domainError('DEPENDENCY_UNAVAILABLE', 'A stored Account or Account group has no valid Account type.'),
  );
}

function saveFailure(
  logger: Logger,
  event: string,
  error: unknown,
  account: Account,
): Err<DomainError> {
  const { code } = describeError(error);
  if (code === UNIQUE_VIOLATION) {
    return err(domainError('NAME_TAKEN', `Another Account is named "${account.name}".`));
  }
  if (code === FOREIGN_KEY_VIOLATION && account.groupId !== null) {
    return err(
      domainError(
        'NOT_FOUND',
        `Account group ${account.groupId} is not one of the User's Account groups of this Account type.`,
      ),
    );
  }
  return databaseFailure(logger, event, error, 'The Account could not be saved.');
}

function groupSaveFailure(
  logger: Logger,
  event: string,
  error: unknown,
  group: AccountGroup,
): Err<DomainError> {
  if (describeError(error).code === UNIQUE_VIOLATION) {
    return err(
      domainError('NAME_TAKEN', `Another Account group of this Account type is named "${group.name}".`),
    );
  }
  return databaseFailure(logger, event, error, 'The Account group could not be saved.');
}

function deleteFailure(
  logger: Logger,
  event: string,
  error: unknown,
  inUse: string,
  failed: string,
): Err<DomainError> {
  if (describeError(error).code === FOREIGN_KEY_VIOLATION) {
    return err(domainError('IN_USE', inUse));
  }
  return databaseFailure(logger, event, error, failed);
}
