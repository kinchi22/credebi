import {
  codeExchangeSchema,
  refreshGrantSchema,
  toTokenResponse,
  type DomainError,
  type Result,
} from '@repo/contracts';
import {
  type CodeExchangeOutcome,
  type ExchangeCode,
  type RefreshAccessToken,
} from '@repo/core';

export type TokenEndpointDependencies = {
  readonly exchangeCode: ExchangeCode;
  readonly refreshAccessToken: RefreshAccessToken;
};

const FORM_TYPE = 'application/x-www-form-urlencoded';

const NO_STORE = { 'cache-control': 'no-store' };

function oauthError(error: string, description: string, status = 400): Response {
  return Response.json({ error, error_description: description }, { status, headers: NO_STORE });
}

async function formOf(request: Request): Promise<URLSearchParams | undefined> {
  const [type = ''] = (request.headers.get('content-type') ?? '').split(';');
  return type.trim().toLowerCase() === FORM_TYPE
    ? new URLSearchParams(await request.text())
    : undefined;
}

function repeatsAParameter(form: URLSearchParams): boolean {
  return [...form.keys()].some((name) => form.getAll(name).length > 1);
}

function tokenResponse(
  answered: Result<CodeExchangeOutcome, DomainError>,
  refusal: string,
): Response {
  if (!answered.ok) {
    return oauthError('server_error', answered.error.message, 500);
  }
  return answered.value.kind === 'granted'
    ? Response.json(toTokenResponse(answered.value.tokens), { headers: NO_STORE })
    : oauthError('invalid_grant', refusal);
}

async function exchangeCode(
  form: URLSearchParams,
  { exchangeCode: exchange }: TokenEndpointDependencies,
): Promise<Response> {
  const parsed = codeExchangeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return oauthError(
      'invalid_request',
      'An authorization_code grant names its code, code_verifier, redirect_uri, client_id and resource.',
    );
  }
  return tokenResponse(
    await exchange(parsed.data),
    'This authorization code is unknown, used, expired, or was issued for another request.',
  );
}

async function refresh(
  form: URLSearchParams,
  { refreshAccessToken }: TokenEndpointDependencies,
): Promise<Response> {
  const parsed = refreshGrantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return oauthError('invalid_request', 'A refresh_token grant names its refresh_token and client_id.');
  }
  return tokenResponse(
    await refreshAccessToken(parsed.data),
    'This refresh token is unknown, expired, revoked, or was issued to another client.',
  );
}

export function serveToken(
  dependencies: () => TokenEndpointDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const form = await formOf(request);
    if (form === undefined || repeatsAParameter(form)) {
      return oauthError('invalid_request', 'A token request is form-encoded, each parameter once.');
    }
    const grantType = form.get('grant_type');
    switch (grantType) {
      case 'authorization_code':
        return exchangeCode(form, dependencies());
      case 'refresh_token':
        return refresh(form, dependencies());
      case null:
        return oauthError('invalid_request', 'A token request names its grant_type.');
      default:
        return oauthError('unsupported_grant_type', `The grant_type ${grantType} is not supported.`);
    }
  };
}
