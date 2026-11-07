import { createHash, randomBytes } from 'node:crypto';
import { type AuthorizationCode, type AuthorizationCodeHash } from '../domain/authorization';
import {
  type AccessToken,
  type AccessTokenHash,
  type RefreshToken,
  type RefreshTokenHash,
} from '../domain/connection';
import { type SessionToken, type SessionTokenHash } from '../domain/session';

function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newSessionToken(): SessionToken {
  return newOpaqueToken() as SessionToken;
}

export function hashSessionToken(token: string): SessionTokenHash {
  return hashOpaqueToken(token) as SessionTokenHash;
}

export function newAuthorizationCode(): AuthorizationCode {
  return newOpaqueToken() as AuthorizationCode;
}

export function hashAuthorizationCode(code: string): AuthorizationCodeHash {
  return hashOpaqueToken(code) as AuthorizationCodeHash;
}

export function newAccessToken(): AccessToken {
  return newOpaqueToken() as AccessToken;
}

export function hashAccessToken(token: string): AccessTokenHash {
  return hashOpaqueToken(token) as AccessTokenHash;
}

export function newRefreshToken(): RefreshToken {
  return newOpaqueToken() as RefreshToken;
}

export function hashRefreshToken(token: string): RefreshTokenHash {
  return hashOpaqueToken(token) as RefreshTokenHash;
}

export function pkceChallengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
