import { type ConnectionId, type DomainError, type Result } from '@repo/contracts';
import {
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type RefreshRotation,
  type RefreshTokenHash,
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
  readonly rotate: (rotation: RefreshRotation) => Promise<Result<boolean, DomainError>>;
  readonly revoke: (connectionId: ConnectionId) => Promise<Result<void, DomainError>>;
};
