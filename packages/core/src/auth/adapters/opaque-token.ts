import { createHash, randomBytes } from 'node:crypto';
import { type AuthorizationCode, type AuthorizationCodeHash } from '../domain/authorization';
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
