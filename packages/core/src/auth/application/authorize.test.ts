import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  ok,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../domain/auth-context';
import {
  type AuthorizationCode,
  type AuthorizationCodeHash,
  type AuthorizationServer,
  type IssuedAuthorizationCode,
} from '../domain/authorization';
import { type ClientDocument } from '../domain/client-document';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { type ClientDocuments } from '../ports/client-documents';
import {
  createApproveAuthorization,
  createBeginAuthorization,
  createDenyAuthorization,
} from './authorize';

const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;
const SIGNED_IN: AuthContext = { userId: USER_ID };
const NOW = new Date('2026-11-07T00:00:00.000Z');
const CLIENT_ID = 'https://client.example/client.json';
const REDIRECT = 'https://app.client.example/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const SERVER: AuthorizationServer = {
  issuer: 'https://books.example',
  mcpUrl: 'https://books.example/mcp',
};
const UNREACHABLE = domainError('INVALID_INPUT', 'The client document could not be fetched.');
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const DOCUMENT: ClientDocument = {
  clientId: CLIENT_ID,
  clientName: 'Example client',
  redirectUris: [REDIRECT],
};

function documents(answer: Result<ClientDocument, DomainError> = ok(DOCUMENT)): ClientDocuments & {
  readonly fetched: string[];
} {
  const fetched: string[] = [];
  return {
    fetched,
    fetch: (clientId) => {
      fetched.push(clientId);
      return Promise.resolve(answer);
    },
  };
}

function codeStore(answer: Result<void, DomainError> = ok(undefined)): Pick<
  AuthorizationCodeRepository,
  'add'
> & {
  readonly codes: IssuedAuthorizationCode[];
} {
  const codes: IssuedAuthorizationCode[] = [];
  return {
    codes,
    add: (code) => {
      if (answer.ok) {
        codes.push(code);
      }
      return Promise.resolve(answer);
    },
  };
}

const query = (changes: Readonly<Record<string, string | null>> = {}): string => {
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    state: 'the-state',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    scope: 'read write',
    resource: SERVER.mcpUrl,
  });
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) {
      search.delete(name);
    } else {
      search.set(name, value);
    }
  }
  return search.toString();
};

function approval(
  clientDocuments: ClientDocuments = documents(),
  codes: Pick<AuthorizationCodeRepository, 'add'> = codeStore(),
) {
  return createApproveAuthorization({
    clientDocuments,
    codes,
    newAuthorizationCode: () => 'the-code' as AuthorizationCode,
    hashAuthorizationCode: (code) => `hash-of-${code}` as AuthorizationCodeHash,
    now: () => NOW,
  });
}

describe('createBeginAuthorization', () => {
  it('asks the User to consent to the client, named as its document states, its redirect host and the scopes', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    expect(await begin(query(), SERVER)).toEqual({
      kind: 'consent',
      request: {
        approved: {
          clientId: CLIENT_ID,
          clientName: 'Example client',
          redirectUris: [REDIRECT],
          redirectUri: REDIRECT,
          scopes: ['read', 'write'],
          codeChallenge: CHALLENGE,
          resource: SERVER.mcpUrl,
        },
        redirectHost: 'app.client.example',
        state: 'the-state',
      },
    });
  });

  it('fetches the client document the request names', async () => {
    const clientDocuments = documents();

    await createBeginAuthorization({ clientDocuments })(query(), SERVER);

    expect(clientDocuments.fetched).toEqual([CLIENT_ID]);
  });

  it("names a client whose document states no name by its client_id's host", async () => {
    const begin = createBeginAuthorization({
      clientDocuments: documents(ok({ ...DOCUMENT, clientName: undefined })),
    });

    const outcome = await begin(query(), SERVER);

    expect(outcome.kind === 'consent' && outcome.request.approved.clientName).toBe('client.example');
  });

  it('refuses without redirecting a request whose client document cannot be fetched', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents(err(UNREACHABLE)) });

    expect(await begin(query(), SERVER)).toEqual({ kind: 'untrusted', reason: UNREACHABLE });
  });

  it('refuses without redirecting a request whose redirect the document does not list', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    expect(await begin(query({ redirect_uri: 'https://elsewhere.example/callback' }), SERVER)).toEqual({
      kind: 'untrusted',
      reason: domainError('INVALID_INPUT', 'The client document does not list this redirect_uri.'),
    });
  });

  it('refuses without fetching anything a request naming no client_id', async () => {
    const clientDocuments = documents();

    const outcome = await createBeginAuthorization({ clientDocuments })(
      query({ client_id: null }),
      SERVER,
    );

    expect(outcome).toEqual({
      kind: 'untrusted',
      reason: domainError(
        'INVALID_INPUT',
        'An authorization request names its client_id and redirect_uri.',
      ),
    });
    expect(clientDocuments.fetched).toEqual([]);
  });

  it('refuses without fetching anything a request naming no redirect_uri', async () => {
    const clientDocuments = documents();

    const outcome = await createBeginAuthorization({ clientDocuments })(
      query({ redirect_uri: null }),
      SERVER,
    );

    expect(outcome.kind).toBe('untrusted');
    expect(clientDocuments.fetched).toEqual([]);
  });

  it('refuses without redirecting a request carrying a parameter twice', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    const outcome = await begin(`${query()}&redirect_uri=${encodeURIComponent(REDIRECT)}`, SERVER);

    expect(outcome).toEqual({
      kind: 'untrusted',
      reason: domainError(
        'INVALID_INPUT',
        'An authorization request carries each parameter at most once.',
      ),
    });
  });

  it('sends a request without S256 PKCE back with invalid_request, its state and the issuer', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    const outcome = await begin(query({ code_challenge_method: 'plain' }), SERVER);

    expect(outcome.kind === 'redirect' && outcome.to.href).toBe(
      `${REDIRECT}?error=invalid_request&state=the-state&iss=https%3A%2F%2Fbooks.example`,
    );
  });

  it('sends a request for another resource back with invalid_target', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    const outcome = await begin(query({ resource: 'https://mcp.example.com/mcp' }), SERVER);

    expect(outcome.kind === 'redirect' && outcome.to.searchParams.get('error')).toBe(
      'invalid_target',
    );
  });

  it('sends a refused request without a state back without one', async () => {
    const begin = createBeginAuthorization({ clientDocuments: documents() });

    const outcome = await begin(query({ state: null, resource: null }), SERVER);

    expect(outcome.kind === 'redirect' && outcome.to.href).toBe(
      `${REDIRECT}?error=invalid_target&iss=https%3A%2F%2Fbooks.example`,
    );
  });
});

describe('createApproveAuthorization', () => {
  it('redirects with a code, the state and the issuer', async () => {
    const result = await approval()(SIGNED_IN, query(), SERVER);

    expect(result.ok && result.value.href).toBe(
      `${REDIRECT}?code=the-code&state=the-state&iss=https%3A%2F%2Fbooks.example`,
    );
  });

  it('stores the code only as its hash, expiring 60 seconds later, with what the Connection will need', async () => {
    const codes = codeStore();

    await approval(documents(ok({ ...DOCUMENT, clientName: undefined })), codes)(
      SIGNED_IN,
      query({ scope: 'read' }),
      SERVER,
    );

    expect(codes.codes).toEqual([
      {
        codeHash: 'hash-of-the-code',
        userId: USER_ID,
        clientId: CLIENT_ID,
        clientName: 'client.example',
        redirectUris: [REDIRECT],
        scopes: ['read'],
        codeChallenge: CHALLENGE,
        redirectUri: REDIRECT,
        resource: SERVER.mcpUrl,
        expiresAt: new Date('2026-11-07T00:01:00.000Z'),
      },
    ]);
  });

  it('issues nothing to a signed-out User', async () => {
    const codes = codeStore();

    const result = await approval(documents(), codes)(SIGNED_OUT, query(), SERVER);

    expect(isErr(result) && result.error.code).toBe('UNAUTHENTICATED');
    expect(codes.codes).toEqual([]);
  });

  it('issues nothing for a request that cannot be trusted to redirect', async () => {
    const codes = codeStore();

    const result = await approval(documents(err(UNREACHABLE)), codes)(SIGNED_IN, query(), SERVER);

    expect(isErr(result) && result.error).toEqual(UNREACHABLE);
    expect(codes.codes).toEqual([]);
  });

  it('issues nothing, and redirects with the refusal, for a request it refuses', async () => {
    const codes = codeStore();

    const result = await approval(documents(), codes)(
      SIGNED_IN,
      query({ code_challenge: null }),
      SERVER,
    );

    expect(result.ok && result.value.searchParams.get('error')).toBe('invalid_request');
    expect(codes.codes).toEqual([]);
  });

  it('redirects nowhere when the code cannot be stored', async () => {
    const result = await approval(documents(), codeStore(err(UNAVAILABLE)))(
      SIGNED_IN,
      query(),
      SERVER,
    );

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('createDenyAuthorization', () => {
  it('sends nothing back for a signed-out User', async () => {
    const clientDocuments = documents();
    const deny = createDenyAuthorization({ clientDocuments });

    const result = await deny(SIGNED_OUT, query(), SERVER);

    expect(isErr(result) && result.error.code).toBe('UNAUTHENTICATED');
    expect(clientDocuments.fetched).toEqual([]);
  });

  it('redirects with access_denied, the state and the issuer', async () => {
    const deny = createDenyAuthorization({ clientDocuments: documents() });

    const result = await deny(SIGNED_IN, query(), SERVER);

    expect(result.ok && result.value.href).toBe(
      `${REDIRECT}?error=access_denied&state=the-state&iss=https%3A%2F%2Fbooks.example`,
    );
  });

  it('redirects nowhere for a request that cannot be trusted to redirect', async () => {
    const deny = createDenyAuthorization({ clientDocuments: documents(err(UNREACHABLE)) });

    const result = await deny(SIGNED_IN, query(), SERVER);

    expect(isErr(result) && result.error).toEqual(UNREACHABLE);
  });

  it('redirects with the refusal for a request it refuses', async () => {
    const deny = createDenyAuthorization({ clientDocuments: documents() });

    const result = await deny(SIGNED_IN, query({ response_type: 'token' }), SERVER);

    expect(result.ok && result.value.searchParams.get('error')).toBe('unsupported_response_type');
  });
});
