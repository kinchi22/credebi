import { OAuthError, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { NO_LIVE_ACCESS_TOKEN, discoveryResponse, serveMcp } from './mcp';

const MCP_PATH = '/mcp';

const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

const ORIGIN = 'https://books.example';

const PROTOCOL_VERSION = '2026-07-28';

const ACCEPTING: OAuthTokenVerifier = {
  verifyAccessToken: (token) =>
    Promise.resolve({
      token,
      clientId: 'https://client.example/client.json',
      scopes: ['read'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }),
};

const REFUSING: OAuthTokenVerifier = {
  verifyAccessToken: () => Promise.reject(new OAuthError('invalid_token', 'Unknown token.')),
};

const get = (path: string, origin = ORIGIN): Request => new Request(`${origin}${path}`);

async function documentAt(path: string, origin = ORIGIN): Promise<Record<string, unknown>> {
  const response = discoveryResponse(get(path, origin));
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

function mcpCall(token: string | undefined, method: string): Request {
  return new Request(`${ORIGIN}${MCP_PATH}`, {
    method: 'POST',
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': PROTOCOL_VERSION,
      'mcp-method': method,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'unit', version: '1.0.0' },
        },
      },
    }),
  });
}

describe('discoveryResponse', () => {
  it('names the MCP URL as the resource, this origin as its authorization server, and both scopes', async () => {
    expect(await documentAt(PROTECTED_RESOURCE_PATH)).toEqual({
      resource: `${ORIGIN}/mcp`,
      authorization_servers: [ORIGIN],
      scopes_supported: ['read', 'write'],
    });
  });

  it('describes this origin as an authorization server with S256, no client secret, CIMD, iss and no registration', async () => {
    expect(await documentAt(AUTHORIZATION_SERVER_PATH)).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      scopes_supported: ['read', 'write'],
    });
  });

  it('takes every URL from the origin the request reached', async () => {
    const origin = 'https://preview.example';

    expect(await documentAt(PROTECTED_RESOURCE_PATH, origin)).toMatchObject({
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
    });
    expect(await documentAt(AUTHORIZATION_SERVER_PATH, origin)).toMatchObject({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
    });
  });

  it('takes the origin from the host the request was forwarded for, as a proxy in front of the server names it', async () => {
    const request = new Request(`http://localhost:3000${AUTHORIZATION_SERVER_PATH}`, {
      headers: { 'x-forwarded-host': 'books.example', 'x-forwarded-proto': 'https' },
    });

    expect(await discoveryResponse(request).json()).toMatchObject({ issuer: 'https://books.example' });
  });

  it('takes the origin from the Host header when nothing forwarded the request', async () => {
    const request = new Request(`http://localhost:3000${AUTHORIZATION_SERVER_PATH}`, {
      headers: { host: '127.0.0.1:3000' },
    });

    expect(await discoveryResponse(request).json()).toMatchObject({ issuer: 'http://127.0.0.1:3000' });
  });


  it('answers 404 for a path that is neither document', () => {
    expect(discoveryResponse(get('/.well-known/openid-configuration')).status).toBe(404);
  });
});

describe('serveMcp', () => {
  it.each([
    ['no Access token', undefined],
    ['a token that is not live', 'not-a-live-token'],
  ])('answers a call with %s with a challenge naming the protected resource metadata', async (_, token) => {
    const response = await serveMcp(REFUSING)(mcpCall(token, 'tools/list'));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(
      new RegExp(`^Bearer .*resource_metadata="${ORIGIN}${PROTECTED_RESOURCE_PATH}"`),
    );
  });

  it('names the protected resource metadata at the host the request was forwarded for', async () => {
    const request = new Request(`http://localhost:3000${MCP_PATH}`, {
      method: 'POST',
      headers: { 'x-forwarded-host': 'books.example', 'x-forwarded-proto': 'https' },
    });

    const response = await serveMcp(REFUSING)(request);

    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="https://books.example${PROTECTED_RESOURCE_PATH}"`,
    );
  });

  it('refuses every token while none is live', async () => {
    const response = await serveMcp(NO_LIVE_ACCESS_TOKEN)(mcpCall('any-token', 'tools/list'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'invalid_token',
      error_description: expect.stringMatching(/\S/) as unknown,
    });
  });

  it('names itself to a client discovering it', async () => {
    const response = await serveMcp(ACCEPTING)(mcpCall('live', 'server/discover'));

    const { result } = (await response.json()) as {
      result: { _meta: Record<string, { name: string; version: string }> };
    };
    expect(result._meta['io.modelcontextprotocol/serverInfo']).toEqual({
      name: 'credebi',
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/) as unknown,
    });
  });

  it('answers a call with a live Access token over Streamable HTTP, offering no tools', async () => {
    const response = await serveMcp(ACCEPTING)(mcpCall('live', 'tools/list'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"tools":[]');
  });
});
