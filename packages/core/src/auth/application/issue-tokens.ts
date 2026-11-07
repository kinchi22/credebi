import { type Scope } from '@repo/contracts';
import {
  ACCESS_TOKEN_SECONDS,
  issuedTokensOf,
  type AccessToken,
  type AccessTokenHash,
  type IssuedTokens,
  type RefreshToken,
  type RefreshTokenHash,
} from '../domain/connection';

export type GrantedTokens = {
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken;
  readonly expiresIn: number;
  readonly scopes: readonly Scope[];
};

export type TokenOutcome =
  | { readonly kind: 'granted'; readonly tokens: GrantedTokens }
  | { readonly kind: 'refused' };

export const REFUSED: TokenOutcome = { kind: 'refused' };

export type TokenIssuer = {
  readonly newAccessToken: () => AccessToken;
  readonly hashAccessToken: (token: string) => AccessTokenHash;
  readonly newRefreshToken: () => RefreshToken;
  readonly hashRefreshToken: (token: string) => RefreshTokenHash;
};

export type IssuedCredentials = {
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken;
  readonly issued: IssuedTokens;
};

export function issueTokens(issuer: TokenIssuer, issuedAt: Date): IssuedCredentials {
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

export function granted(credentials: IssuedCredentials, scopes: readonly Scope[]): TokenOutcome {
  return {
    kind: 'granted',
    tokens: {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresIn: ACCESS_TOKEN_SECONDS,
      scopes,
    },
  };
}
