import { ok, type DomainError, type Result } from '@repo/contracts';
import {
  ACCESS_TOKEN_SECONDS,
  refreshDecision,
  type RefreshTokenHash,
} from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import {
  issueTokens,
  REFUSED,
  type CodeExchangeOutcome,
  type TokenIssuer,
} from './exchange-code';

export type RefreshGrant = {
  readonly refreshToken: string;
  readonly clientId: string;
};

export type RefreshOutcome = CodeExchangeOutcome;

export type RefreshAccessTokenDependencies = TokenIssuer & {
  readonly connections: ConnectionRepository;
  readonly hashRefreshToken: (token: string) => RefreshTokenHash;
  readonly now: () => Date;
};

export type RefreshAccessToken = (
  grant: RefreshGrant,
) => Promise<Result<RefreshOutcome, DomainError>>;

export function createRefreshAccessToken(
  dependencies: RefreshAccessTokenDependencies,
): RefreshAccessToken {
  const { connections, hashRefreshToken, now } = dependencies;
  return async (grant) => {
    const found = await connections.findRefreshToken(hashRefreshToken(grant.refreshToken));
    if (!found.ok) {
      return found;
    }
    const issuedAt = now();
    const decision = refreshDecision(found.value, grant, issuedAt);
    if (decision.kind === 'refuse') {
      return ok(REFUSED);
    }
    if (decision.kind === 'revoke') {
      const revoked = await connections.revoke(decision.connectionId);
      return revoked.ok ? ok(REFUSED) : revoked;
    }
    const { accessToken, refreshToken, issued } = issueTokens(dependencies, issuedAt);
    const rotated = await connections.rotate({
      connectionId: decision.connectionId,
      replaced: decision.replaced,
      discarded: decision.discarded,
      tokens: issued,
    });
    if (!rotated.ok) {
      return rotated;
    }
    return ok(
      rotated.value
        ? {
            kind: 'granted',
            tokens: { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS, scopes: decision.scopes },
          }
        : REFUSED,
    );
  };
}
