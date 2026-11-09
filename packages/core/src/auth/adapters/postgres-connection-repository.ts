import { and, desc, eq, isNull, lte } from 'drizzle-orm';
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
  type RotationOutcome,
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

function successorOf(
  tokenHash: RefreshTokenHash,
  row: {
    readonly replacedByHash: string | null;
    readonly successorHash: string | null;
    readonly successorReplacedByHash: string | null;
  },
): RefreshSuccessor | undefined {
  return row.replacedByHash === null || row.replacedByHash === tokenHash
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
            lastUsedAt: schema.connections.lastUsedAt,
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
            lastUsedAt: schema.connections.lastUsedAt,
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
                discarded: row.replacedByHash === tokenHash,
                successor: successorOf(tokenHash, row),
                lastUsedAt: row.lastUsedAt,
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

    rotate: async (rotation: RefreshRotation): Promise<Result<RotationOutcome, DomainError>> => {
      const { connectionId, replaced, discards, tokens, rotatedAt } = rotation;
      try {
        await database.transaction(async (transaction) => {
          const marked = await transaction
            .update(schema.refreshTokens)
            .set({ replacedByHash: tokens.refreshTokenHash })
            .where(
              and(
                eq(schema.refreshTokens.tokenHash, replaced),
                eq(schema.refreshTokens.connectionId, connectionId),
                discards === undefined
                  ? isNull(schema.refreshTokens.replacedByHash)
                  : eq(schema.refreshTokens.replacedByHash, discards),
              ),
            )
            .returning({ tokenHash: schema.refreshTokens.tokenHash });
          if (marked.length === 0) {
            throw new RotationOvertaken();
          }
          if (discards !== undefined) {
            const discarded = await transaction
              .update(schema.refreshTokens)
              .set({ replacedByHash: discards })
              .where(
                and(
                  eq(schema.refreshTokens.tokenHash, discards),
                  isNull(schema.refreshTokens.replacedByHash),
                ),
              )
              .returning({ tokenHash: schema.refreshTokens.tokenHash });
            if (discarded.length === 0) {
              throw new RotationOvertaken();
            }
          }
          await transaction
            .delete(schema.refreshTokens)
            .where(
              and(
                eq(schema.refreshTokens.connectionId, connectionId),
                lte(schema.refreshTokens.expiresAt, rotatedAt),
              ),
            );
          await transaction
            .update(schema.connections)
            .set({ lastUsedAt: rotatedAt })
            .where(eq(schema.connections.id, connectionId));
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
        return ok('rotated');
      } catch (error) {
        if (error instanceof RotationOvertaken) {
          return ok('overtaken');
        }
        return databaseFailure(
          logger,
          'auth.rotate_refresh_token_failed',
          error,
          'The refresh token could not be rotated.',
        );
      }
    },

    markUsed: async (connectionId: ConnectionId, at: Date): Promise<Result<void, DomainError>> => {
      try {
        await database
          .update(schema.connections)
          .set({ lastUsedAt: at })
          .where(eq(schema.connections.id, connectionId));
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.mark_connection_used_failed',
          error,
          'The Connection\'s last use could not be recorded.',
        );
      }
    },

    listLive: async (
      userId: UserId,
      lapseCutoff: Date,
    ): Promise<Result<readonly Connection[], DomainError>> => {
      try {
        const rows = await database.transaction(async (transaction) => {
          await transaction
            .delete(schema.connections)
            .where(
              and(
                eq(schema.connections.userId, userId),
                lte(schema.connections.lastUsedAt, lapseCutoff),
              ),
            );
          return transaction
            .select()
            .from(schema.connections)
            .where(eq(schema.connections.userId, userId))
            .orderBy(desc(schema.connections.createdAt), desc(schema.connections.id));
        });
        return ok(
          rows.map((row) => ({
            ...row,
            id: row.id as ConnectionId,
            userId: row.userId as UserId,
            scopes: row.scopes as Scope[],
          })),
        );
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.list_connections_failed',
          error,
          'The Connections could not be read.',
        );
      }
    },

    revokeOwnedBy: async (
      userId: UserId,
      connectionId: ConnectionId,
    ): Promise<Result<void, DomainError>> => {
      try {
        await database
          .delete(schema.connections)
          .where(and(eq(schema.connections.id, connectionId), eq(schema.connections.userId, userId)));
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
