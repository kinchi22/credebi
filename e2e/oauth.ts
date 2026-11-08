import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import {
  expect,
  test as base,
  type APIRequestContext,
  type APIResponse,
  type Locator,
  type Page,
} from '@playwright/test';
import { documentLanguage, type Language } from './language';

export const MCP_PATH = '/mcp';

export const AUTHORIZE_PATH = '/oauth/authorize';

export const TOKEN_PATH = '/oauth/token';

export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

export const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

export const SCOPES = ['read', 'write'] as const;

export type Scope = (typeof SCOPES)[number];

export const ACCESS_TOKEN_SECONDS = 3600;

export const CODE_SECONDS = 60;

export const LOOPBACK_HOST = '127.0.0.1';

export const SCOPE_SHOWN: Readonly<Record<Scope, RegExp>> = {
  read: /read your books/i,
  write: /post entries/i,
};

export const RAW_SCOPE_NAME = /\bwrite\b|\bread\b(?! your books)/i;

export const UNVERIFIED_NAME = /not verified/i;

export const CALLBACK_PATH = '/callback';

const DOCUMENT_PATH = '/client.json';

export type Served =
  | { readonly kind: 'document'; readonly document: Readonly<Record<string, unknown>> }
  | { readonly kind: 'raw'; readonly status: number; readonly contentType: string; readonly body: string };

export type McpClient = {
  readonly name: string;
  readonly origin: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly callbacks: readonly URL[];
  readonly document: () => Readonly<Record<string, unknown>>;
  readonly serve: (served: Served) => void;
  readonly close: () => Promise<void>;
};

export const clientDocument = (
  clientId: string,
  name: string,
  redirectUris: readonly string[],
): Readonly<Record<string, unknown>> => ({
  client_id: clientId,
  client_name: name,
  redirect_uris: redirectUris,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
});

export async function startClient(name = `E2E client ${randomUUID()}`): Promise<McpClient> {
  const callbacks: URL[] = [];
  let served: Served | undefined;

  const answer = (request: IncomingMessage, response: ServerResponse): void => {
    const url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`);
    if (url.pathname === CALLBACK_PATH) {
      callbacks.push(url);
      response.writeHead(200, { 'content-type': 'text/html' }).end('<p>Connected</p>');
      return;
    }
    if (url.pathname !== DOCUMENT_PATH || served === undefined) {
      response.writeHead(404).end();
      return;
    }
    if (served.kind === 'document') {
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify(served.document));
      return;
    }
    response.writeHead(served.status, { 'content-type': served.contentType }).end(served.body);
  };

  const server = createServer(answer);
  await new Promise<void>((resolve) => server.listen(0, LOOPBACK_HOST, resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://${LOOPBACK_HOST}:${String(port)}`;
  const clientId = `${origin}${DOCUMENT_PATH}`;
  const redirectUri = `${origin}${CALLBACK_PATH}`;
  const initial = clientDocument(clientId, name, [redirectUri]);
  served = { kind: 'document', document: initial };

  return {
    name,
    origin,
    clientId,
    redirectUri,
    callbacks,
    document: () => initial,
    serve: (next) => {
      served = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

async function useClient(use: (client: McpClient) => Promise<void>): Promise<void> {
  const client = await startClient();
  try {
    await use(client);
  } finally {
    await client.close();
  }
}

export const test = base.extend<{ client: McpClient; otherClient: McpClient }>({
  client: async ({ baseURL }, use) => {
    expect(baseURL, 'an MCP client needs the app origin to connect to').toBeDefined();
    await useClient(use);
  },
  otherClient: async ({ baseURL }, use) => {
    expect(baseURL, 'an MCP client needs the app origin to connect to').toBeDefined();
    await useClient(use);
  },
});

export { expect };

export const originOf = (baseURL: string | undefined): string => new URL(baseURL ?? '').origin;

export const mcpUrlOf = (baseURL: string | undefined): string => `${originOf(baseURL)}${MCP_PATH}`;

export type Pkce = { readonly verifier: string; readonly challenge: string };

export function newPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export type Authorization = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly pkce: Pkce;
  readonly scope: string;
  readonly resource: string;
};

export type AuthorizationOptions = {
  readonly scopes?: readonly Scope[];
  readonly redirectUri?: string;
};

export const newAuthorization = (
  client: McpClient,
  baseURL: string | undefined,
  { scopes = SCOPES, redirectUri = client.redirectUri }: AuthorizationOptions = {},
): Authorization => ({
  clientId: client.clientId,
  redirectUri,
  state: randomUUID(),
  pkce: newPkce(),
  scope: scopes.join(' '),
  resource: mcpUrlOf(baseURL),
});

export type ParamChanges = Readonly<Record<string, string | null>>;

function withChanges(params: Readonly<Record<string, string>>, changes: ParamChanges): URLSearchParams {
  const query = new URLSearchParams(params);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) query.delete(name);
    else query.set(name, value);
  }
  return query;
}

export const authorizeQuery = (authorization: Authorization, changes: ParamChanges = {}): URLSearchParams =>
  withChanges(
    {
      response_type: 'code',
      client_id: authorization.clientId,
      redirect_uri: authorization.redirectUri,
      state: authorization.state,
      code_challenge: authorization.pkce.challenge,
      code_challenge_method: 'S256',
      scope: authorization.scope,
      resource: authorization.resource,
    },
    changes,
  );

export const authorizePath = (authorization: Authorization, changes: ParamChanges = {}): string =>
  `${AUTHORIZE_PATH}?${authorizeQuery(authorization, changes).toString()}`;

export const consentPage = (page: Page): Locator => page.getByRole('main');

const APPROVE_LABEL: Readonly<Record<Language, string>> = {
  en: 'Approve',
  ko: '\uD5C8\uC6A9',
  ja: '\u8A31\u53EF',
};

const isLanguage = (value: string | null): value is Language =>
  value !== null && Object.hasOwn(APPROVE_LABEL, value);

const approveButtonIn = (page: Page, language: Language): Locator =>
  consentPage(page).getByRole('button', { name: APPROVE_LABEL[language], exact: true });

export const approveButton = (page: Page): Locator => approveButtonIn(page, 'en');

export const denyButton = (page: Page): Locator =>
  consentPage(page).getByRole('button', { name: 'Deny', exact: true });

export async function expectRefusedWithoutRedirect(page: Page, client: McpClient): Promise<void> {
  await expect(consentPage(page).getByRole('alert')).toBeVisible();
  await expect(approveButton(page)).toHaveCount(0);
  await expect(denyButton(page)).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(AUTHORIZE_PATH);
  expect(client.callbacks, 'nothing was sent back to the MCP client').toEqual([]);
}

export async function redirectedTo(page: Page, redirectUri: string): Promise<URL> {
  await page.waitForURL((url) => `${url.origin}${url.pathname}` === redirectUri, { timeout: 10_000 });
  return new URL(page.url());
}

export async function openConsent(page: Page, authorization: Authorization): Promise<void> {
  await page.goto(authorizePath(authorization));
  await expect(approveButton(page)).toBeVisible();
}

export async function approveFor(page: Page, authorization: Authorization): Promise<URL> {
  await openConsent(page, authorization);
  await approveButton(page).click();
  return redirectedTo(page, authorization.redirectUri);
}

export function codeFrom(callback: URL, authorization: Authorization): string {
  expect(callback.searchParams.get('error')).toBeNull();
  expect(callback.searchParams.get('state')).toBe(authorization.state);
  const code = callback.searchParams.get('code') ?? '';
  expect(code, 'the authorization response carries a code').not.toBe('');
  return code;
}

export async function authorizationCode(page: Page, authorization: Authorization): Promise<string> {
  return codeFrom(await approveFor(page, authorization), authorization);
}

export const exchangeCode = (
  request: APIRequestContext,
  authorization: Authorization,
  code: string,
  changes: ParamChanges = {},
  tokenEndpoint: string = TOKEN_PATH,
): Promise<APIResponse> =>
  request.post(tokenEndpoint, {
    form: Object.fromEntries(
      withChanges(
        {
          grant_type: 'authorization_code',
          code,
          code_verifier: authorization.pkce.verifier,
          redirect_uri: authorization.redirectUri,
          client_id: authorization.clientId,
          resource: authorization.resource,
        },
        changes,
      ),
    ),
  });

export const refreshWith = (
  request: APIRequestContext,
  clientId: string,
  refreshToken: string,
): Promise<APIResponse> =>
  request.post(TOKEN_PATH, {
    form: { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId },
  });

export type Tokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly scopes: readonly string[];
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function recordOf(value: unknown, what: string): Readonly<Record<string, unknown>> {
  expect(isRecord(value), `${what} is a JSON object`).toBe(true);
  return isRecord(value) ? value : {};
}

export function stringAt(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  expect(typeof value, `${key} is a string`).toBe('string');
  return typeof value === 'string' ? value : '';
}

export async function tokensFrom(response: APIResponse): Promise<Tokens> {
  expect(response.status(), (await response.text()).slice(0, 300)).toBe(200);
  const body = recordOf(await response.json(), 'the token response');
  const expiresIn = body['expires_in'];
  expect(typeof expiresIn, 'expires_in is a number').toBe('number');
  return {
    accessToken: stringAt(body, 'access_token'),
    refreshToken: stringAt(body, 'refresh_token'),
    tokenType: stringAt(body, 'token_type'),
    expiresIn: typeof expiresIn === 'number' ? expiresIn : 0,
    scopes: stringAt(body, 'scope').split(' ').filter((scope) => scope !== '').sort(),
  };
}

export async function expectOAuthError(response: APIResponse, error: string): Promise<void> {
  expect(response.status()).toBe(400);
  const body = recordOf(await response.json(), 'the error response');
  expect(body['error']).toBe(error);
  expect(body['access_token']).toBeUndefined();
}

export const expectInvalidGrant = (response: APIResponse): Promise<void> =>
  expectOAuthError(response, 'invalid_grant');

export type Connected = {
  readonly authorization: Authorization;
  readonly tokens: Tokens;
};

export async function connect(
  page: Page,
  request: APIRequestContext,
  client: McpClient,
  options: AuthorizationOptions = {},
): Promise<Connected> {
  const authorization = newAuthorization(client, base.info().project.use.baseURL, options);
  await page.goto(authorizePath(authorization));
  const language = await documentLanguage(page).getAttribute('lang');
  expect(isLanguage(language), `the consent page is in a known Language, not ${String(language)}`).toBe(true);
  await approveButtonIn(page, isLanguage(language) ? language : 'en').click();
  const code = codeFrom(await redirectedTo(page, authorization.redirectUri), authorization);
  const tokens = await tokensFrom(await exchangeCode(request, authorization, code));
  return { authorization, tokens };
}

export async function closedClient(): Promise<McpClient> {
  const client = await startClient();
  await client.close();
  return client;
}
