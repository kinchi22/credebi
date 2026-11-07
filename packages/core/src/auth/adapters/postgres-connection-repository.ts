import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
  type RefreshRotation,
  type RefreshSuccessor,
  type RefreshTokenHash,
  type StoredAccessToken,
  type StoredRefreshToken,
} from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import { databaseFailure } from './database-failure';

export type PostgresConnectionRepository = ConnectionRepository & {
  close: () => Promise<void>;
};

const successors = alias(schema.refreshTokens, 'successors');

class RotationOvertaken extends Error {}

function successorOf(row: {
  readonly replacedByHash: string | null;
  readonly successorHash: string | null;
  readonly successorReplacedByHash: string | null;
}): RefreshSuccessor | undefined {
  return row.replacedByHash === null
    ? undefined
    : {
        tokenHash: row.replacedByHash as RefreshTokenHash,
        used: row.successorHash === null || row.successorReplacedByHash !== null,
      };
}

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

    findRefreshToken: async (
      tokenHash: RefreshTokenHash,
    ): Promise<Result<StoredRefreshToken | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({
            connectionId: schema.connections.id,
            clientId: schema.connections.clientId,
            scopes: schema.connections.scopes,
            expiresAt: schema.refreshTokens.expiresAt,
            replacedByHash: schema.refreshTokens.replacedByHash,
            successorReplacedByHash: successors.replacedByHash,
            successorHash: successors.tokenHash,
          })
          .from(schema.refreshTokens)
          .innerJoin(schema.connections, eq(schema.connections.id, schema.refreshTokens.connectionId))
          .leftJoin(successors, eq(successors.tokenHash, schema.refreshTokens.replacedByHash))
          .where(eq(schema.refreshTokens.tokenHash, tokenHash));
        return ok(
          row === undefined
            ? undefined
            : {
                tokenHash,
                connectionId: row.connectionId as ConnectionId,
                clientId: row.clientId,
                scopes: row.scopes as Scope[],
                expiresAt: row.expiresAt,
                successor: successorOf(row),
              },
        );
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.find_refresh_token_failed',
          error,
          'The refresh token could not be read.',
        );
      }
    },

    rotate: async (rotation: RefreshRotation): Promise<Result<boolean, DomainError>> => {
      const { connectionId, replaced, discarded, tokens } = rotation;
      try {
        await database.transaction(async (transaction) => {
          const marked = await transaction
            .update(schema.refreshTokens)
            .set({ replacedByHash: tokens.refreshTokenHash })
            .where(
              and(
                eq(schema.refreshTokens.tokenHash, replaced),
                eq(schema.refreshTokens.connectionId, connectionId),
                discarded === undefined
                  ? isNull(schema.refreshTokens.replacedByHash)
                  : eq(schema.refreshTokens.replacedByHash, discarded),
              ),
            )
            .returning({ tokenHash: schema.refreshTokens.tokenHash });
          if (marked.length === 0) {
            throw new RotationOvertaken();
          }
          if (discarded !== undefined) {
            const dropped = await transaction
              .delete(schema.refreshTokens)
              .where(
                and(
                  eq(schema.refreshTokens.tokenHash, discarded),
                  isNull(schema.refreshTokens.replacedByHash),
                ),
              )
              .returning({ tokenHash: schema.refreshTokens.tokenHash });
            if (dropped.length === 0) {
              throw new RotationOvertaken();
            }
          }
          await transaction.insert(schema.accessTokens).values({
            tokenHash: tokens.accessTokenHash,
            connectionId,
            expiresAt: tokens.accessTokenExpiresAt,
          });
          await transaction.insert(schema.refreshTokens).values({
            tokenHash: tokens.refreshTokenHash,
            connectionId,
            expiresAt: tokens.refreshTokenExpiresAt,
          });
        });
        return ok(true);
      } catch (error) {
        if (error instanceof RotationOvertaken) {
          return ok(false);
        }
        return databaseFailure(
          logger,
          'auth.rotate_refresh_token_failed',
          error,
          'The refresh token could not be rotated.',
        );
      }
    },

    revoke: async (connectionId: ConnectionId): Promise<Result<void, DomainError>> => {
      try {
        await database.delete(schema.connections).where(eq(schema.connections.id, connectionId));
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.revoke_connection_failed',
          error,
          'The Connection could not be revoked.',
        );
      }
    },

    close,
  };
}
