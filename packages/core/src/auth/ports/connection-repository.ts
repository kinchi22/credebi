import { type DomainError, type Result } from '@repo/contracts';
import {
  type AccessTokenHash,
  type Connection,
  type IssuedTokens,
  type StoredAccessToken,
} from '../domain/connection';

export type ConnectionRepository = {
  readonly open: (
    connection: Connection,
    tokens: IssuedTokens,
  ) => Promise<Result<void, DomainError>>;
  readonly findAccessToken: (
    tokenHash: AccessTokenHash,
  ) => Promise<Result<StoredAccessToken | undefined, DomainError>>;
};
