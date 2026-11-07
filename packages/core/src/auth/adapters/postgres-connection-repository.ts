import { eq } from 'drizzle-orm';
import {
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
  type Scope,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { type Logger } from '../../logging/ports/logger';
import {
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type StoredAccessToken,
} from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import { databaseFailure } from './database-failure';

export type PostgresConnectionRepository = ConnectionRepository & {
  close: () => Promise<void>;
};

export function createPostgresConnectionRepository(
  connectionString: string,
  logger: Logger,
): PostgresConnectionRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    open: async (
      connection: Connection,
      tokens: IssuedTokens,
    ): Promise<Result<void, DomainError>> => {
      try {
        await database.transaction(async (transaction) => {
          await transaction.insert(schema.connections).values({
            ...connection,
            redirectUris: [...connection.redirectUris],
            scopes: [...connection.scopes],
          });
          await transaction.insert(schema.accessTokens).values({
            tokenHash: tokens.accessTokenHash,
            connectionId: connection.id,
            expiresAt: tokens.accessTokenExpiresAt,
          });
          await transaction.insert(schema.refreshTokens).values({
            tokenHash: tokens.refreshTokenHash,
            connectionId: connection.id,
            expiresAt: tokens.refreshTokenExpiresAt,
          });
        });
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.open_connection_failed',
          error,
          'The Connection could not be stored.',
        );
      }
    },

    findAccessToken: async (
      tokenHash: AccessTokenHash,
    ): Promise<Result<StoredAccessToken | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({
            connectionId: schema.connections.id,
            userId: schema.connections.userId,
            clientId: schema.connections.clientId,
            scopes: schema.connections.scopes,
            expiresAt: schema.accessTokens.expiresAt,
          })
          .from(schema.accessTokens)
          .innerJoin(schema.connections, eq(schema.connections.id, schema.accessTokens.connectionId))
          .where(eq(schema.accessTokens.tokenHash, tokenHash));
        return ok(
          row === undefined
            ? undefined
            : {
                ...row,
                connectionId: row.connectionId as ConnectionId,
                userId: row.userId as UserId,
                scopes: row.scopes as Scope[],
              },
        );
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.find_access_token_failed',
          error,
          'The Access token could not be read.',
        );
      }
    },

    close,
  };
}
