import { ok, type DomainError, type Result } from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { type Logger } from '../../logging/ports/logger';
import { type IssuedAuthorizationCode } from '../domain/authorization';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { databaseFailure } from './database-failure';

export type PostgresAuthorizationCodeRepository = AuthorizationCodeRepository & {
  close: () => Promise<void>;
};

export function createPostgresAuthorizationCodeRepository(
  connectionString: string,
  logger: Logger,
): PostgresAuthorizationCodeRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    add: async (code: IssuedAuthorizationCode): Promise<Result<void, DomainError>> => {
      try {
        await database.insert(schema.authorizationCodes).values({
          ...code,
          redirectUris: [...code.redirectUris],
          scopes: [...code.scopes],
        });
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.add_authorization_code_failed',
          error,
          'The authorization code could not be stored.',
        );
      }
    },

    close,
  };
}
