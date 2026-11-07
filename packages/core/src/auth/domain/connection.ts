import {
  type Brand,
  type ConnectionId,
  type Scope,
  type UserId,
} from '@repo/contracts';
import { type AuthContext } from './auth-context';
import { type IssuedAuthorizationCode } from './authorization';

export type AccessToken = Brand<string, 'AccessToken'>;

export type AccessTokenHash = Brand<string, 'AccessTokenHash'>;

export type RefreshToken = Brand<string, 'RefreshToken'>;

export type RefreshTokenHash = Brand<string, 'RefreshTokenHash'>;

export const ACCESS_TOKEN_SECONDS = 60 * 60;

export const REFRESH_TOKEN_DAYS = 30;

const SECOND_MS = 1000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;

export type Connection = {
  readonly id: ConnectionId;
  readonly userId: UserId;
  readonly clientId: string;
  readonly clientName: string;
  readonly redirectUris: readonly string[];
  readonly scopes: readonly Scope[];
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
};

export type IssuedTokens = {
  readonly accessTokenHash: AccessTokenHash;
  readonly accessTokenExpiresAt: Date;
  readonly refreshTokenHash: RefreshTokenHash;
  readonly refreshTokenExpiresAt: Date;
};

export type StoredAccessToken = {
  readonly connectionId: ConnectionId;
  readonly userId: UserId;
  readonly clientId: string;
  readonly scopes: readonly Scope[];
  readonly expiresAt: Date;
};

export type AccessGrant = {
  readonly auth: AuthContext;
  readonly clientId: string;
  readonly expiresAt: Date;
};

export type RefreshSuccessor = {
  readonly tokenHash: RefreshTokenHash;
  readonly used: boolean;
};

export type StoredRefreshToken = {
  readonly tokenHash: RefreshTokenHash;
  readonly connectionId: ConnectionId;
  readonly clientId: string;
  readonly scopes: readonly Scope[];
  readonly expiresAt: Date;
  readonly discarded: boolean;
  readonly successor: RefreshSuccessor | undefined;
};

export type PresentedRefreshToken = {
  readonly clientId: string;
};

export type RefreshDecision =
  | {
      readonly kind: 'rotate';
      readonly connectionId: ConnectionId;
      readonly scopes: readonly Scope[];
      readonly replaced: RefreshTokenHash;
      readonly discards: RefreshTokenHash | undefined;
    }
  | { readonly kind: 'revoke'; readonly connectionId: ConnectionId }
  | { readonly kind: 'refuse' };

export type RefreshRotation = {
  readonly connectionId: ConnectionId;
  readonly replaced: RefreshTokenHash;
  readonly discards: RefreshTokenHash | undefined;
  readonly tokens: IssuedTokens;
  readonly rotatedAt: Date;
};

export type RotationOutcome = 'rotated' | 'overtaken';

export function accessTokenExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + ACCESS_TOKEN_SECONDS * SECOND_MS);
}

export function refreshTokenExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + REFRESH_TOKEN_DAYS * DAY_MS);
}

export function accessTokenLive(token: Pick<StoredAccessToken, 'expiresAt'>, now: Date): boolean {
  return now.getTime() < token.expiresAt.getTime();
}

export function accessGrantOf(token: StoredAccessToken): AccessGrant {
  return {
    auth: { userId: token.userId, scopes: token.scopes },
    clientId: token.clientId,
    expiresAt: token.expiresAt,
  };
}

export function connectionFrom(
  code: IssuedAuthorizationCode,
  id: ConnectionId,
  now: Date,
): Connection {
  return {
    id,
    userId: code.userId,
    clientId: code.clientId,
    clientName: code.clientName,
    redirectUris: code.redirectUris,
    scopes: code.scopes,
    createdAt: now,
    lastUsedAt: now,
  };
}

export function issuedTokensOf(
  hashes: Pick<IssuedTokens, 'accessTokenHash' | 'refreshTokenHash'>,
  issuedAt: Date,
): IssuedTokens {
  return {
    accessTokenHash: hashes.accessTokenHash,
    accessTokenExpiresAt: accessTokenExpiry(issuedAt),
    refreshTokenHash: hashes.refreshTokenHash,
    refreshTokenExpiresAt: refreshTokenExpiry(issuedAt),
  };
}

export function refreshDecision(
  token: StoredRefreshToken | undefined,
  presented: PresentedRefreshToken,
  now: Date,
): RefreshDecision {
  if (
    token === undefined ||
    now.getTime() >= token.expiresAt.getTime() ||
    token.clientId !== presented.clientId
  ) {
    return { kind: 'refuse' };
  }
  const { successor } = token;
  if (token.discarded || successor?.used === true) {
    return { kind: 'revoke', connectionId: token.connectionId };
  }
  return {
    kind: 'rotate',
    connectionId: token.connectionId,
    scopes: token.scopes,
    replaced: token.tokenHash,
    discards: successor?.tokenHash,
  };
}
