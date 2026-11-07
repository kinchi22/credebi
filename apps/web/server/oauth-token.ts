import { codeExchangeSchema, toTokenResponse } from '@repo/contracts';
import { type CodeExchangeOutcome, type ExchangeCode } from '@repo/core';

export type TokenEndpointDependencies = {
  readonly exchangeCode: ExchangeCode;
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

function tokenResponse(outcome: CodeExchangeOutcome): Response {
  return outcome.kind === 'granted'
    ? Response.json(toTokenResponse(outcome.tokens), { headers: NO_STORE })
    : oauthError(
        'invalid_grant',
        'This authorization code is unknown, used, expired, or was issued for another request.',
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
    if (grantType !== 'authorization_code') {
      return grantType === null
        ? oauthError('invalid_request', 'A token request names its grant_type.')
        : oauthError('unsupported_grant_type', `The grant_type ${grantType} is not supported.`);
    }
    const exchange = codeExchangeSchema.safeParse(Object.fromEntries(form));
    if (!exchange.success) {
      return oauthError(
        'invalid_request',
        'An authorization_code grant names its code, code_verifier, redirect_uri, client_id and resource.',
      );
    }
    const exchanged = await dependencies().exchangeCode(exchange.data);
    return exchanged.ok
      ? tokenResponse(exchanged.value)
      : oauthError('server_error', exchanged.error.message, 500);
  };
}
