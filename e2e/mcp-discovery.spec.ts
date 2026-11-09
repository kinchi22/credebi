import { randomUUID } from 'node:crypto';
import { signIn } from './session';
import { expectUnauthorized, listTools, mcpPost, READ_TOOLS, WRITE_TOOLS } from './mcp';
import {
  AUTHORIZATION_SERVER_PATH,
  AUTHORIZE_PATH,
  exchangeCode,
  MCP_PATH,
  SCOPES,
  TOKEN_PATH,
  authorizeQuery,
  codeFrom,
  expect,
  newAuthorization,
  approveButton,
  originOf,
  PROTECTED_RESOURCE_PATH,
  recordOf,
  redirectedTo,
  stringAt,
  test,
  tokensFrom,
} from './oauth';

test('names the MCP URL, this deployment as its authorization server and both scopes in the protected resource metadata', async ({ request, baseURL }) => {
  const origin = originOf(baseURL);

  const response = await request.get(PROTECTED_RESOURCE_PATH);

  expect(response.status()).toBe(200);
  const metadata = recordOf(await response.json(), 'the protected resource metadata');
  expect(metadata['resource']).toBe(`${origin}${MCP_PATH}`);
  expect(metadata['authorization_servers']).toEqual([origin]);
  expect(metadata['scopes_supported']).toEqual([...SCOPES]);
});

test('describes the authorization server with code and PKCE S256, no client secret, Client ID Metadata Documents and no registration endpoint', async ({ request, baseURL }) => {
  const origin = originOf(baseURL);

  const response = await request.get(AUTHORIZATION_SERVER_PATH);

  expect(response.status()).toBe(200);
  const metadata = recordOf(await response.json(), 'the authorization server metadata');
  expect(metadata).toMatchObject({
    issuer: origin,
    authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
    token_endpoint: `${origin}${TOKEN_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [...SCOPES],
  });
  expect(metadata['registration_endpoint']).toBeUndefined();
});

test('answers a call without an Access token with a challenge naming the protected resource metadata', async ({ request, baseURL }) => {
  await expectUnauthorized(await mcpPost(request, undefined, 'tools/list'), originOf(baseURL));
});

test('answers a call with a token it never issued as it answers one with none', async ({ request, baseURL }) => {
  await expectUnauthorized(await mcpPost(request, randomUUID(), 'tools/list'), originOf(baseURL));
});

test('connects an MCP client that starts from the MCP URL alone, finding every endpoint by discovery', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const origin = originOf(baseURL);

  const challenged = await mcpPost(request, undefined, 'tools/list');
  await expectUnauthorized(challenged, origin);
  const resourceMetadataUrl =
    /resource_metadata="([^"]+)"/.exec(challenged.headers()['www-authenticate'] ?? '')?.[1] ?? '';
  const resource = recordOf(await (await request.get(resourceMetadataUrl)).json(), 'resource metadata');
  const [issuer] = resource['authorization_servers'] as readonly string[];
  const server = recordOf(
    await (await request.get(`${issuer ?? ''}${AUTHORIZATION_SERVER_PATH}`)).json(),
    'authorization server metadata',
  );

  const authorization = {
    ...newAuthorization(client, baseURL),
    resource: stringAt(resource, 'resource'),
  };
  await page.goto(`${stringAt(server, 'authorization_endpoint')}?${authorizeQuery(authorization).toString()}`);
  await approveButton(page).click();
  const callback = await redirectedTo(page, client.redirectUri);
  const code = codeFrom(callback, authorization);

  const tokens = await tokensFrom(
    await exchangeCode(request, authorization, code, {}, stringAt(server, 'token_endpoint')),
  );

  expect(await listTools(request, tokens.accessToken)).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
});
