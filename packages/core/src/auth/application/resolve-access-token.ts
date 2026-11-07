import { ok, type DomainError, type Result } from '@repo/contracts';
import {
  accessGrantOf,
  accessTokenLive,
  type AccessGrant,
  type AccessTokenHash,
} from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';

export type ResolveAccessTokenDependencies = {
  readonly connections: ConnectionRepository;
  readonly hashAccessToken: (token: string) => AccessTokenHash;
  readonly now: () => Date;
};

export type ResolveAccessToken = (
  token: string,
) => Promise<Result<AccessGrant | undefined, DomainError>>;

export function createResolveAccessToken({
  connections,
  hashAccessToken,
  now,
}: ResolveAccessTokenDependencies): ResolveAccessToken {
  return async (token) => {
    const found = await connections.findAccessToken(hashAccessToken(token));
    if (!found.ok) {
      return found;
    }
    const stored = found.value;
    return ok(stored !== undefined && accessTokenLive(stored, now()) ? accessGrantOf(stored) : undefined);
  };
}
