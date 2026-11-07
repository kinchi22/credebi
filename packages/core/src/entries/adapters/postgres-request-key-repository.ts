import { and, eq } from 'drizzle-orm';
import {
  domainError,
  err,
  ok,
  type DomainError,
  type EntryId,
  type Result,
  type UserId,
} from '@repo/contracts';
import { schema } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import {
  type RecordedRequestKey,
  type RequestKeyRepository,
} from '../ports/request-key-repository';
import { type PostgresExecutor } from './postgres-entry-repository';

export function postgresRequestKeysOn(
  database: PostgresExecutor,
  logger: Logger,
): RequestKeyRepository {
  return {
    find: async (
      userId: UserId,
      requestKey: string,
    ): Promise<Result<EntryId | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({ entryId: schema.requestKeys.entryId })
          .from(schema.requestKeys)
          .where(
            and(eq(schema.requestKeys.userId, userId), eq(schema.requestKeys.key, requestKey)),
          );
        return ok(row?.entryId as EntryId | undefined);
      } catch (error) {
        logger.error(
          { event: 'entries.request_key_find_failed', error: describeError(error) },
          'A Request key could not be read.',
        );
        return err(
          domainError('DEPENDENCY_UNAVAILABLE', 'The Request key could not be read.'),
        );
      }
    },

    record: async (
      userId: UserId,
      { requestKey, entryId, connectionId }: RecordedRequestKey,
    ): Promise<Result<void, DomainError>> => {
      try {
        const inserted = await database
          .insert(schema.requestKeys)
          .values({ userId, key: requestKey, entryId, connectionId: connectionId ?? null })
          .onConflictDoNothing()
          .returning({ key: schema.requestKeys.key });
        return inserted.length === 0
          ? err(domainError('CONFLICT', `Request key "${requestKey}" is used already.`))
          : ok(undefined);
      } catch (error) {
        logger.error(
          { event: 'entries.request_key_record_failed', entryId, error: describeError(error) },
          'A Request key could not be recorded.',
        );
        return err(
          domainError('DEPENDENCY_UNAVAILABLE', 'The Request key could not be recorded.'),
        );
      }
    },
  };
}
