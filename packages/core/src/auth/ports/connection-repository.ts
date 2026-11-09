import {
  type ConnectionId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import {
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type RefreshRotation,
  type RefreshTokenHash,
  type RotationOutcome,
  type StoredAccessToken,
  type StoredRefreshToken,
} from '../domain/connection';

export type ConnectionRepository = {
  readonly open: (
    connection: Connection,
    tokens: IssuedTokens,
  ) => Promise<Result<void, DomainError>>;
  readonly findAccessToken: (
    tokenHash: AccessTokenHash,
  ) => Promise<Result<StoredAccessToken | undefined, DomainError>>;
  readonly findRefreshToken: (
    tokenHash: RefreshTokenHash,
  ) => Promise<Result<StoredRefreshToken | undefined, DomainError>>;
  readonly rotate: (rotation: RefreshRotation) => Promise<Result<RotationOutcome, DomainError>>;
  readonly markUsed: (connectionId: ConnectionId, at: Date) => Promise<Result<void, DomainError>>;
  readonly listLive: (
    userId: UserId,
    lapseCutoff: Date,
  ) => Promise<Result<readonly Connection[], DomainError>>;
  readonly revoke: (connectionId: ConnectionId) => Promise<Result<void, DomainError>>;
  readonly revokeOwnedBy: (
    userId: UserId,
    connectionId: ConnectionId,
  ) => Promise<Result<void, DomainError>>;
};
