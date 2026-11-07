import {
  McpServer,
  OAuthError,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth,
  type AuthMetadataOptions,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { SCOPES } from '@repo/contracts';

export const MCP_PATH = '/mcp';

export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

export const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

const AUTHORIZE_PATH = '/oauth/authorize';

const TOKEN_PATH = '/oauth/token';

const SERVER_INFO = { name: 'credebi', version: '1.0.0' };

export const NO_LIVE_ACCESS_TOKEN: OAuthTokenVerifier = {
  verifyAccessToken: () =>
    Promise.reject(new OAuthError('invalid_token', 'This Access token is not live.')),
};

function discovery(origin: string): AuthMetadataOptions {
  return {
    oauthMetadata: {
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
    },
    resourceServerUrl: new URL(MCP_PATH, origin),
    scopesSupported: [...SCOPES],
  };
}

function originOf(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const forwardedProtocol = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProtocol === null ? url.protocol : `${forwardedProtocol}:`;
  return `${protocol}//${host}`;
}

export function discoveryResponse(request: Request): Response {
  const origin = originOf(request);
  return oauthMetadataResponse(request, discovery(origin)) ?? new Response(null, { status: 404 });
}

const handler = createMcpHandler(() => new McpServer(SERVER_INFO, { capabilities: { tools: {} } }));

export function serveMcp(verifier: OAuthTokenVerifier): (request: Request) => Promise<Response> {
  return async (request) => {
    const resource = new URL(MCP_PATH, originOf(request));
    const access = await requireBearerAuth({
      verifier,
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
    })(request);
    return access instanceof Response ? access : handler.fetch(request, { authInfo: access });
  };
}
