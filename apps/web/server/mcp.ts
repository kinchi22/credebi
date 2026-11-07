import {
  McpServer,
  OAuthError,
  OAuthErrorCode,
  bearerAuthChallengeResponse,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth,
  type AuthInfo,
  type AuthMetadataOptions,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { SCOPES, scopeSchema, userIdSchema } from '@repo/contracts';
import { type AuthContext, type ResolveAccessToken } from '@repo/core';
import { z } from 'zod';
import { registerTools, scopeGranted, toolScope, type ToolDependencies } from './mcp-tools';
import { AUTHORIZE_PATH, MCP_PATH, TOKEN_PATH, requestOrigin } from './oauth';

const SERVER_INFO = { name: 'credebi', version: '1.0.0' };

export type McpDependencies = ToolDependencies & {
  readonly resolveAccessToken: ResolveAccessToken;
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
  return requestOrigin(request.headers, new URL(request.url));
}

export function discoveryResponse(request: Request): Response {
  const origin = originOf(request);
  return oauthMetadataResponse(request, discovery(origin)) ?? new Response(null, { status: 404 });
}

export function accessTokenVerifier(resolveAccessToken: ResolveAccessToken): OAuthTokenVerifier {
  return {
    verifyAccessToken: async (token) => {
      const resolved = await resolveAccessToken(token);
      if (!resolved.ok) {
        throw new OAuthError(OAuthErrorCode.ServerError, resolved.error.message);
      }
      if (resolved.value === undefined) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'This Access token is not live.');
      }
      const { auth, clientId, expiresAt } = resolved.value;
      return {
        token,
        clientId,
        scopes: [...(auth.scopes ?? [])],
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
        extra: { userId: auth.userId },
      };
    },
  };
}

export function authContextOf(authInfo: AuthInfo | undefined): AuthContext {
  const userId = userIdSchema.safeParse(authInfo?.extra?.['userId']);
  return {
    userId: userId.success ? userId.data : undefined,
    scopes: (authInfo?.scopes ?? []).flatMap((scope) => {
      const parsed = scopeSchema.safeParse(scope);
      return parsed.success ? [parsed.data] : [];
    }),
  };
}

const toolCallSchema = z.object({
  method: z.literal('tools/call'),
  params: z.object({ name: z.string() }),
});

function calledTools(body: unknown): readonly string[] {
  const messages: readonly unknown[] = Array.isArray(body) ? body : [body];
  return messages.flatMap((message) => {
    const parsed = toolCallSchema.safeParse(message);
    return parsed.success ? [parsed.data.params.name] : [];
  });
}

async function scopeChallenge(
  request: Request,
  authInfo: AuthInfo,
  resourceMetadataUrl: string,
): Promise<Response | undefined> {
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => undefined);
  const missing = calledTools(body)
    .map(toolScope)
    .find((scope) => scope !== undefined && !scopeGranted(authInfo.scopes, scope));
  return missing === undefined
    ? undefined
    : bearerAuthChallengeResponse(
        new OAuthError(OAuthErrorCode.InsufficientScope, `This tool needs the ${missing} scope.`),
        { requiredScopes: [missing], resourceMetadataUrl },
      );
}

export function serveMcp(
  dependencies: () => McpDependencies,
): (request: Request) => Promise<Response> {
  const handler = createMcpHandler(({ authInfo }) => {
    const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
    registerTools(server, authContextOf(authInfo), dependencies());
    return server;
  });
  return async (request) => {
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
      new URL(MCP_PATH, originOf(request)),
    );
    const access = await requireBearerAuth({
      verifier: accessTokenVerifier(dependencies().resolveAccessToken),
      resourceMetadataUrl,
    })(request);
    if (access instanceof Response) {
      return access;
    }
    return (
      (await scopeChallenge(request, access, resourceMetadataUrl)) ??
      handler.fetch(request, { authInfo: access })
    );
  };
}
