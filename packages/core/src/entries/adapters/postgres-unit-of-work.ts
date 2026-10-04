import { domainError, err, type DomainError, type Err } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type UnitOfWork } from '../ports/unit-of-work';
import { postgresEntriesOn } from './postgres-entry-repository';

export type PostgresUnitOfWork = UnitOfWork & {
  readonly close: () => Promise<void>;
};

class RolledBack extends Error {
  constructor(readonly refusal: Err<DomainError>) {
    super(refusal.error.message);
  }
}

export function createPostgresUnitOfWork(
  connectionString: string,
  logger: Logger,
): PostgresUnitOfWork {
  const { database, close } = createDatabase(connectionString);

  return {
    run: async (work) => {
      try {
        return await database.transaction(async (transaction) => {
          const done = await work(postgresEntriesOn(transaction, logger));
          if (!done.ok) {
            throw new RolledBack(done);
          }
          return done;
        });
      } catch (thrown) {
        if (thrown instanceof RolledBack) {
          return thrown.refusal;
        }
        logger.error(
          { event: 'entries.unit_of_work_failed', error: describeError(thrown) },
          'A unit of work on the entries could not commit.',
        );
        return err(
          domainError('DEPENDENCY_UNAVAILABLE', 'The change to the entries could not be stored.'),
        );
      }
    },
    close,
  };
}
