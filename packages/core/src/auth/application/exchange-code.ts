import {
  domainError,
  err,
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
  type Scope,
} from '@repo/contracts';
import {
  codeRedeemable,
  type AuthorizationCodeHash,
  type CodeExchange,
} from '../domain/authorization';
import {
  ACCESS_TOKEN_SECONDS,
  accessTokenExpiry,
  connectionFrom,
  refreshTokenExpiry,
  type AccessToken,
  type AccessTokenHash,
  type RefreshToken,
  type RefreshTokenHash,
} from '../domain/connection';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { type ConnectionRepository } from '../ports/connection-repository';

export type GrantedTokens = {
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken;
  readonly expiresIn: number;
  readonly scopes: readonly Scope[];
};

export type ExchangeCodeDependencies = {
  readonly codes: AuthorizationCodeRepository;
  readonly connections: ConnectionRepository;
  readonly hashAuthorizationCode: (code: string) => AuthorizationCodeHash;
  readonly pkceChallengeOf: (verifier: string) => string;
  readonly newConnectionId: () => ConnectionId;
  readonly newAccessToken: () => AccessToken;
  readonly hashAccessToken: (token: string) => AccessTokenHash;
  readonly newRefreshToken: () => RefreshToken;
  readonly hashRefreshToken: (token: string) => RefreshTokenHash;
  readonly now: () => Date;
};

export type ExchangeCode = (exchange: CodeExchange) => Promise<Result<GrantedTokens, DomainError>>;

const INVALID_GRANT = domainError(
  'INVALID_INPUT',
  'This authorization code is unknown, used, expired, or was issued for another request.',
);

export function createExchangeCode(dependencies: ExchangeCodeDependencies): ExchangeCode {
  const { codes, connections, hashAuthorizationCode, pkceChallengeOf, now } = dependencies;
  return async (exchange) => {
    const taken = await codes.take(hashAuthorizationCode(exchange.code));
    if (!taken.ok) {
      return taken;
    }
    const issuedAt = now();
    const code = taken.value;
    const presented = { ...exchange, verifierChallenge: pkceChallengeOf(exchange.codeVerifier) };
    if (code === undefined || !codeRedeemable(code, presented, issuedAt)) {
      return err(INVALID_GRANT);
    }
    const accessToken = dependencies.newAccessToken();
    const refreshToken = dependencies.newRefreshToken();
    const opened = await connections.open(
      connectionFrom(code, dependencies.newConnectionId(), issuedAt),
      {
        accessTokenHash: dependencies.hashAccessToken(accessToken),
        accessTokenExpiresAt: accessTokenExpiry(issuedAt),
        refreshTokenHash: dependencies.hashRefreshToken(refreshToken),
        refreshTokenExpiresAt: refreshTokenExpiry(issuedAt),
      },
    );
    if (!opened.ok) {
      return opened;
    }
    return ok({ accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS, scopes: code.scopes });
  };
}
