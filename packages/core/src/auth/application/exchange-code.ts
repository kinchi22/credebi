import {
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
  connectionFrom,
  issuedTokensOf,
  type AccessToken,
  type AccessTokenHash,
  type IssuedTokens,
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

export type CodeExchangeOutcome =
  | { readonly kind: 'granted'; readonly tokens: GrantedTokens }
  | { readonly kind: 'refused' };

export type ExchangeCode = (
  exchange: CodeExchange,
) => Promise<Result<CodeExchangeOutcome, DomainError>>;

export const REFUSED: CodeExchangeOutcome = { kind: 'refused' };

export type TokenIssuer = Pick<
  ExchangeCodeDependencies,
  'newAccessToken' | 'hashAccessToken' | 'newRefreshToken' | 'hashRefreshToken'
>;

export function issueTokens(
  issuer: TokenIssuer,
  issuedAt: Date,
): { readonly accessToken: AccessToken; readonly refreshToken: RefreshToken; readonly issued: IssuedTokens } {
  const accessToken = issuer.newAccessToken();
  const refreshToken = issuer.newRefreshToken();
  return {
    accessToken,
    refreshToken,
    issued: issuedTokensOf(
      {
        accessTokenHash: issuer.hashAccessToken(accessToken),
        refreshTokenHash: issuer.hashRefreshToken(refreshToken),
      },
      issuedAt,
    ),
  };
}

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
      return ok(REFUSED);
    }
    const { accessToken, refreshToken, issued } = issueTokens(dependencies, issuedAt);
    const opened = await connections.open(
      connectionFrom(code, dependencies.newConnectionId(), issuedAt),
      issued,
    );
    if (!opened.ok) {
      return opened;
    }
    return ok({
      kind: 'granted',
      tokens: { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS, scopes: code.scopes },
    });
  };
}
