import {
  SCOPES,
  domainError,
  err,
  ok,
  type Brand,
  type DomainError,
  type Result,
  type Scope,
  type UserId,
} from '@repo/contracts';
import { clientAddressAllowed } from './client-address';
import { type ClientDocument } from './client-document';

export type AuthorizationCode = Brand<string, 'AuthorizationCode'>;

export type AuthorizationCodeHash = Brand<string, 'AuthorizationCodeHash'>;

export const AUTHORIZATION_CODE_SECONDS = 60;

export type IssuedAuthorizationCode = {
  readonly codeHash: AuthorizationCodeHash;
  readonly userId: UserId;
  readonly clientId: string;
  readonly clientName: string;
  readonly redirectUris: readonly string[];
  readonly scopes: readonly Scope[];
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly resource: string;
  readonly expiresAt: Date;
};

export type AuthorizationServer = {
  readonly issuer: string;
  readonly mcpUrl: string;
};

export type AuthorizationParameters = {
  readonly responseType: string | undefined;
  readonly clientId: string | undefined;
  readonly redirectUri: string | undefined;
  readonly state: string | undefined;
  readonly codeChallenge: string | undefined;
  readonly codeChallengeMethod: string | undefined;
  readonly scope: string | undefined;
  readonly resource: string | undefined;
};

const PARAMETER_NAMES: Readonly<Record<keyof AuthorizationParameters, string>> = {
  responseType: 'response_type',
  clientId: 'client_id',
  redirectUri: 'redirect_uri',
  state: 'state',
  codeChallenge: 'code_challenge',
  codeChallengeMethod: 'code_challenge_method',
  scope: 'scope',
  resource: 'resource',
};

const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export function authorizationParameters(
  query: string,
): Result<AuthorizationParameters, DomainError> {
  const search = new URLSearchParams(query);
  const entries = Object.entries(PARAMETER_NAMES);
  if (entries.some(([, name]) => search.getAll(name).length > 1)) {
    return err(
      domainError('INVALID_INPUT', 'An authorization request carries each parameter at most once.'),
    );
  }
  return ok(
    Object.fromEntries(
      entries.map(([key, name]) => [key, search.get(name) ?? undefined]),
    ) as AuthorizationParameters,
  );
}

export function redirectUriListed(listed: readonly string[], requested: string): boolean {
  if (!URL.canParse(requested) || requested.includes('#')) {
    return false;
  }
  return listed.some((one) => one === requested || loopbackMatches(one, requested));
}

function loopbackMatches(listed: string, requested: string): boolean {
  if (!URL.canParse(listed)) {
    return false;
  }
  const listedUrl = new URL(listed);
  const requestedUrl = new URL(requested);
  if (listedUrl.protocol !== 'http:' || !isLoopback(listedUrl.hostname)) {
    return false;
  }
  listedUrl.port = '';
  requestedUrl.port = '';
  return listedUrl.href === requestedUrl.href;
}

function isLoopback(hostname: string): boolean {
  const address = hostname.replace('[', '').replace(']', '');
  return hostname === 'localhost' || clientAddressAllowed(address, 'loopback');
}

export function pkceChallengeAccepted(
  method: string | undefined,
  challenge: string | undefined,
): challenge is string {
  return method === 'S256' && S256_CHALLENGE.test(String(challenge));
}

export function resourceAccepted(
  resource: string | undefined,
  mcpUrl: string,
): resource is string {
  return resource === mcpUrl;
}

export function requestedScopes(scope: string | undefined): readonly Scope[] | undefined {
  if (scope === undefined || scope === '') {
    return SCOPES;
  }
  const asked = scope.split(' ');
  if (!asked.every((one) => (SCOPES as readonly string[]).includes(one))) {
    return undefined;
  }
  return SCOPES.filter((one) => asked.includes(one));
}

export type RequestedGrant = {
  readonly scopes: readonly Scope[];
  readonly codeChallenge: string;
  readonly resource: string;
};

export type AuthorizationRefusal =
  | 'unsupported_response_type'
  | 'invalid_request'
  | 'invalid_scope'
  | 'invalid_target';

export function requestedGrant(
  parameters: AuthorizationParameters,
  mcpUrl: string,
): Result<RequestedGrant, AuthorizationRefusal> {
  const { responseType, codeChallenge, codeChallengeMethod, resource } = parameters;
  if (responseType !== 'code') {
    return err('unsupported_response_type');
  }
  if (!pkceChallengeAccepted(codeChallengeMethod, codeChallenge)) {
    return err('invalid_request');
  }
  const scopes = requestedScopes(parameters.scope);
  if (scopes === undefined) {
    return err('invalid_scope');
  }
  if (!resourceAccepted(resource, mcpUrl)) {
    return err('invalid_target');
  }
  return ok({ scopes, codeChallenge, resource });
}

export function clientNameOf(document: ClientDocument): string {
  return document.clientName ?? new URL(document.clientId).host;
}

export function authorizationResponse(
  redirectUri: string,
  parameters: Readonly<Record<string, string | undefined>>,
): URL {
  const url = new URL(redirectUri);
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined) {
      url.searchParams.append(name, value);
    }
  }
  return url;
}

export function authorizationCodeExpiry(now: Date): Date {
  return new Date(now.getTime() + AUTHORIZATION_CODE_SECONDS * 1000);
}
