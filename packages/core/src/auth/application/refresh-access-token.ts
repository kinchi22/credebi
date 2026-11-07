import { ok, type DomainError, type Result } from '@repo/contracts';
import { refreshDecision } from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';
import {
  granted,
  issueTokens,
  REFUSED,
  type TokenIssuer,
  type TokenOutcome,
} from './issue-tokens';

export type RefreshGrant = {
  readonly refreshToken: string;
  readonly clientId: string;
};

export type RefreshAccessTokenDependencies = TokenIssuer & {
  readonly connections: ConnectionRepository;
  readonly now: () => Date;
};

export type RefreshAccessToken = (
  grant: RefreshGrant,
) => Promise<Result<TokenOutcome, DomainError>>;

export function createRefreshAccessToken(
  dependencies: RefreshAccessTokenDependencies,
): RefreshAccessToken {
  const { connections, now } = dependencies;
  return async (grant) => {
    const found = await connections.findRefreshToken(
      dependencies.hashRefreshToken(grant.refreshToken),
    );
    if (!found.ok) {
      return found;
    }
    const rotatedAt = now();
    const decision = refreshDecision(found.value, grant, rotatedAt);
    if (decision.kind === 'refuse') {
      return ok(REFUSED);
    }
    if (decision.kind === 'revoke') {
      const revoked = await connections.revoke(decision.connectionId);
      return revoked.ok ? ok(REFUSED) : revoked;
    }
    const credentials = issueTokens(dependencies, rotatedAt);
    const rotated = await connections.rotate({
      connectionId: decision.connectionId,
      replaced: decision.replaced,
      discards: decision.discards,
      tokens: credentials.issued,
      rotatedAt,
    });
    if (!rotated.ok) {
      return rotated;
    }
    return ok(rotated.value === 'rotated' ? granted(credentials, decision.scopes) : REFUSED);
  };
}
