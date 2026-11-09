import { ok, type DomainError, type Result } from '@repo/contracts';
import {
  accessGrantOf,
  accessTokenLive,
  connectionLapsed,
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
    const usedAt = now();
    if (stored === undefined) {
      return ok(undefined);
    }
    if (connectionLapsed(stored.lastUsedAt, usedAt)) {
      const revoked = await connections.revoke(stored.connectionId);
      return revoked.ok ? ok(undefined) : revoked;
    }
    if (!accessTokenLive(stored, usedAt)) {
      return ok(undefined);
    }
    const marked = await connections.markUsed(stored.connectionId, usedAt);
    return marked.ok ? ok(accessGrantOf(stored)) : marked;
  };
}
