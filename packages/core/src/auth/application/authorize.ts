import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../domain/auth-context';
import {
  authorizationCodeExpiry,
  authorizationParameters,
  authorizationResponse,
  clientNameOf,
  redirectUriListed,
  requestedGrant,
  type AuthorizationCode,
  type AuthorizationCodeHash,
  type ApprovedRequest,
  type AuthorizationServer,
} from '../domain/authorization';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { type ClientDocuments } from '../ports/client-documents';

export type ConsentRequest = {
  readonly approved: ApprovedRequest;
  readonly redirectHost: string;
  readonly state: string | undefined;
};

export type AuthorizationOutcome =
  | { readonly kind: 'untrusted'; readonly reason: DomainError }
  | { readonly kind: 'redirect'; readonly to: URL }
  | { readonly kind: 'consent'; readonly request: ConsentRequest };

export type BeginAuthorizationDependencies = {
  readonly clientDocuments: ClientDocuments;
};

export type BeginAuthorization = (
  query: string,
  server: AuthorizationServer,
) => Promise<AuthorizationOutcome>;

export type ApproveAuthorizationDependencies = BeginAuthorizationDependencies & {
  readonly codes: AuthorizationCodeRepository;
  readonly newAuthorizationCode: () => AuthorizationCode;
  readonly hashAuthorizationCode: (code: string) => AuthorizationCodeHash;
  readonly now: () => Date;
};

export type ApproveAuthorization = (
  auth: AuthContext,
  query: string,
  server: AuthorizationServer,
) => Promise<Result<URL, DomainError>>;

export type DenyAuthorization = (
  auth: AuthContext,
  query: string,
  server: AuthorizationServer,
) => Promise<Result<URL, DomainError>>;

const untrusted = (message: string): AuthorizationOutcome => ({
  kind: 'untrusted',
  reason: domainError('INVALID_INPUT', message),
});

export function createBeginAuthorization({
  clientDocuments,
}: BeginAuthorizationDependencies): BeginAuthorization {
  return async (query, server) => {
    const parameters = authorizationParameters(query);
    if (!parameters.ok) {
      return { kind: 'untrusted', reason: parameters.error };
    }
    const { clientId, redirectUri } = parameters.value;
    if (clientId === undefined || redirectUri === undefined) {
      return untrusted('An authorization request names its client_id and redirect_uri.');
    }
    const document = await clientDocuments.fetch(clientId);
    if (!document.ok) {
      return { kind: 'untrusted', reason: document.error };
    }
    if (!redirectUriListed(document.value.redirectUris, redirectUri)) {
      return untrusted('The client document does not list this redirect_uri.');
    }
    const grant = requestedGrant(parameters.value, server.mcpUrl);
    if (!grant.ok) {
      return {
        kind: 'redirect',
        to: authorizationResponse(redirectUri, {
          error: grant.error,
          state: parameters.value.state,
          iss: server.issuer,
        }),
      };
    }
    return {
      kind: 'consent',
      request: {
        approved: {
          ...grant.value,
          clientId,
          clientName: clientNameOf(document.value),
          redirectUris: document.value.redirectUris,
          redirectUri,
        },
        redirectHost: new URL(redirectUri).host,
        state: parameters.value.state,
      },
    };
  };
}

export function createApproveAuthorization({
  clientDocuments,
  codes,
  newAuthorizationCode,
  hashAuthorizationCode,
  now,
}: ApproveAuthorizationDependencies): ApproveAuthorization {
  const begin = createBeginAuthorization({ clientDocuments });
  return async (auth, query, server) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }
    const outcome = await begin(query, server);
    if (outcome.kind !== 'consent') {
      return settled(outcome);
    }
    const { approved, state } = outcome.request;
    const code = newAuthorizationCode();
    const stored = await codes.add({
      ...approved,
      codeHash: hashAuthorizationCode(code),
      userId: userId.value,
      expiresAt: authorizationCodeExpiry(now()),
    });
    if (!stored.ok) {
      return stored;
    }
    return ok(
      authorizationResponse(approved.redirectUri, {
        code,
        state,
        iss: server.issuer,
      }),
    );
  };
}

export function createDenyAuthorization({
  clientDocuments,
}: BeginAuthorizationDependencies): DenyAuthorization {
  const begin = createBeginAuthorization({ clientDocuments });
  return async (auth, query, server) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }
    const outcome = await begin(query, server);
    if (outcome.kind !== 'consent') {
      return settled(outcome);
    }
    return ok(
      authorizationResponse(outcome.request.approved.redirectUri, {
        error: 'access_denied',
        state: outcome.request.state,
        iss: server.issuer,
      }),
    );
  };
}

function settled(
  outcome: Exclude<AuthorizationOutcome, { readonly kind: 'consent' }>,
): Result<URL, DomainError> {
  return outcome.kind === 'redirect' ? ok(outcome.to) : err(outcome.reason);
}
