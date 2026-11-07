export const MCP_PATH = '/mcp';

export const AUTHORIZE_PATH = '/oauth/authorize';

export const TOKEN_PATH = '/oauth/token';

export type AuthorizationServerUrls = {
  readonly issuer: string;
  readonly mcpUrl: string;
};

export function requestOrigin(headers: Pick<Headers, 'get'>, url?: URL): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? url?.host ?? '';
  const forwardedProtocol = headers.get('x-forwarded-proto');
  const protocol = forwardedProtocol === null ? (url?.protocol ?? 'http:') : `${forwardedProtocol}:`;
  return `${protocol}//${host}`;
}

export function authorizationServerAt(origin: string): AuthorizationServerUrls {
  return { issuer: origin, mcpUrl: new URL(MCP_PATH, origin).href };
}
