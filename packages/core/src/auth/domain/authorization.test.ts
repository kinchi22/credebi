import { describe, expect, it } from 'vitest';
import { isErr } from '@repo/contracts';
import {
  AUTHORIZATION_CODE_SECONDS,
  authorizationCodeExpiry,
  authorizationParameters,
  authorizationResponse,
  clientNameOf,
  pkceChallengeAccepted,
  redirectUriListed,
  requestedGrant,
  requestedScopes,
  type AuthorizationParameters,
  resourceAccepted,
} from './authorization';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('redirectUriListed', () => {
  it('accepts a redirect the client document lists exactly', () => {
    expect(
      redirectUriListed(['https://client.example/callback'], 'https://client.example/callback'),
    ).toBe(true);
  });

  it('accepts a redirect any one of the listed redirects matches', () => {
    expect(
      redirectUriListed(
        ['https://client.example/one', 'https://client.example/two'],
        'https://client.example/two',
      ),
    ).toBe(true);
  });

  it('refuses a redirect the client document does not list', () => {
    expect(
      redirectUriListed(['https://client.example/callback'], 'https://client.example/elsewhere'),
    ).toBe(false);
  });

  it('refuses a redirect that differs from a listed one only in its port, off loopback', () => {
    expect(
      redirectUriListed(['https://client.example/callback'], 'https://client.example:8443/callback'),
    ).toBe(false);
  });

  it('refuses a redirect that adds a query to a listed one', () => {
    expect(
      redirectUriListed(['https://client.example/callback'], 'https://client.example/callback?x=1'),
    ).toBe(false);
  });

  it('refuses a redirect that differs from a listed one only in case', () => {
    expect(
      redirectUriListed(['https://client.example/callback'], 'https://client.example/Callback'),
    ).toBe(false);
  });

  it('refuses a redirect carrying a fragment, even one listed', () => {
    expect(
      redirectUriListed(['https://client.example/callback#x'], 'https://client.example/callback#x'),
    ).toBe(false);
  });

  it('accepts a loopback http redirect on any port when one is listed without a port', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://127.0.0.1:53124/callback'),
    ).toBe(true);
  });

  it('accepts a loopback http redirect on a port other than the listed one', () => {
    expect(
      redirectUriListed(['http://127.0.0.1:3000/callback'], 'http://127.0.0.1:53124/callback'),
    ).toBe(true);
  });

  it('accepts a localhost redirect on any port', () => {
    expect(
      redirectUriListed(['http://localhost/callback'], 'http://localhost:53124/callback'),
    ).toBe(true);
  });

  it('accepts an IPv6 loopback redirect on any port', () => {
    expect(redirectUriListed(['http://[::1]/callback'], 'http://[::1]:53124/callback')).toBe(true);
  });

  it('accepts any address in 127.0.0.0/8 as loopback', () => {
    expect(
      redirectUriListed(['http://127.0.0.2/callback'], 'http://127.0.0.2:53124/callback'),
    ).toBe(true);
  });

  it('refuses a loopback redirect on another path', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://127.0.0.1:53124/elsewhere'),
    ).toBe(false);
  });

  it('refuses a loopback redirect with another query', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://127.0.0.1:53124/callback?x=1'),
    ).toBe(false);
  });

  it('refuses a loopback redirect with a fragment', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://127.0.0.1:53124/callback#x'),
    ).toBe(false);
  });

  it('refuses a loopback redirect to another loopback host', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://localhost:53124/callback'),
    ).toBe(false);
  });

  it('refuses a loopback https redirect on another port, since only http loopback floats', () => {
    expect(
      redirectUriListed(['https://127.0.0.1/callback'], 'https://127.0.0.1:53124/callback'),
    ).toBe(false);
  });

  it('refuses an http redirect to a host that is not loopback, even one listed', () => {
    expect(
      redirectUriListed(['http://client.example/callback'], 'http://client.example/callback'),
    ).toBe(false);
  });

  it('accepts a listed http loopback redirect on its own port', () => {
    expect(
      redirectUriListed(['http://127.0.0.1:3000/callback'], 'http://127.0.0.1:3000/callback'),
    ).toBe(true);
  });

  it('accepts a listed redirect with a scheme of its own', () => {
    expect(redirectUriListed(['com.client.app:/callback'], 'com.client.app:/callback')).toBe(true);
  });

  it('refuses an http redirect on another port to a host that is not loopback', () => {
    expect(
      redirectUriListed(['http://client.example/callback'], 'http://client.example:8080/callback'),
    ).toBe(false);
  });

  it('refuses an http loopback redirect where an https one is listed', () => {
    expect(
      redirectUriListed(['https://127.0.0.1/callback'], 'http://127.0.0.1:53124/callback'),
    ).toBe(false);
  });

  it('refuses a loopback redirect carrying credentials the listed one does not', () => {
    expect(
      redirectUriListed(['http://127.0.0.1/callback'], 'http://user:pass@127.0.0.1:53124/callback'),
    ).toBe(false);
  });

  it('refuses a redirect that is not a URL', () => {
    expect(redirectUriListed(['http://127.0.0.1/callback'], 'not a url')).toBe(false);
  });

  it('refuses every redirect when a listed one is not a URL', () => {
    expect(redirectUriListed(['not a url'], 'http://127.0.0.1:53124/callback')).toBe(false);
  });
});

describe('pkceChallengeAccepted', () => {
  it('accepts an S256 challenge', () => {
    expect(pkceChallengeAccepted('S256', CHALLENGE)).toBe(true);
  });

  it('refuses a plain challenge', () => {
    expect(pkceChallengeAccepted('plain', CHALLENGE)).toBe(false);
  });

  it('refuses a challenge without a method', () => {
    expect(pkceChallengeAccepted(undefined, CHALLENGE)).toBe(false);
  });

  it('refuses a method without a challenge', () => {
    expect(pkceChallengeAccepted('S256', undefined)).toBe(false);
  });

  it('refuses an S256 challenge that is not 43 base64url characters', () => {
    expect(pkceChallengeAccepted('S256', CHALLENGE.slice(1))).toBe(false);
    expect(pkceChallengeAccepted('S256', `${CHALLENGE}A`)).toBe(false);
    expect(pkceChallengeAccepted('S256', `+${CHALLENGE.slice(1)}`)).toBe(false);
  });
});

describe('resourceAccepted', () => {
  const MCP_URL = 'https://books.example/mcp';

  it("accepts this deployment's MCP URL", () => {
    expect(resourceAccepted(MCP_URL, MCP_URL)).toBe(true);
  });

  it('refuses another MCP URL', () => {
    expect(resourceAccepted('https://mcp.example.com/mcp', MCP_URL)).toBe(false);
  });

  it('refuses the MCP URL with a trailing slash', () => {
    expect(resourceAccepted(`${MCP_URL}/`, MCP_URL)).toBe(false);
  });

  it('refuses a request naming no resource', () => {
    expect(resourceAccepted(undefined, MCP_URL)).toBe(false);
  });
});

describe('requestedScopes', () => {
  it('reads the scopes asked for, in the order the scopes are defined', () => {
    expect(requestedScopes('write read')).toEqual(['read', 'write']);
  });

  it('reads a single scope', () => {
    expect(requestedScopes('read')).toEqual(['read']);
  });

  it('reads a scope asked for twice once', () => {
    expect(requestedScopes('write write')).toEqual(['write']);
  });

  it('asks for every scope when the request names none', () => {
    expect(requestedScopes(undefined)).toEqual(['read', 'write']);
    expect(requestedScopes('')).toEqual(['read', 'write']);
  });

  it('refuses a scope it does not know', () => {
    expect(requestedScopes('read admin')).toBeUndefined();
  });

  it('refuses scopes separated by anything but one space', () => {
    expect(requestedScopes('read  write')).toBeUndefined();
    expect(requestedScopes('read,write')).toBeUndefined();
  });
});

describe('clientNameOf', () => {
  it('is the name the client document states', () => {
    expect(
      clientNameOf({
        clientId: 'https://claude.ai/oauth/client.json',
        clientName: 'Claude',
        redirectUris: [],
      }),
    ).toBe('Claude');
  });

  it("is the host of the client_id when the document states no name", () => {
    expect(
      clientNameOf({
        clientId: 'https://claude.ai/oauth/client.json',
        clientName: undefined,
        redirectUris: [],
      }),
    ).toBe('claude.ai');
  });

  it("keeps the port of a client_id served on one", () => {
    expect(
      clientNameOf({
        clientId: 'http://127.0.0.1:4000/client.json',
        clientName: undefined,
        redirectUris: [],
      }),
    ).toBe('127.0.0.1:4000');
  });
});

describe('authorizationResponse', () => {
  it('adds the parameters to the redirect, keeping its own query', () => {
    const url = authorizationResponse('https://client.example/callback?keep=1', {
      code: 'the-code',
      state: 'the-state',
      iss: 'https://books.example',
    });

    expect(url.href).toBe(
      'https://client.example/callback?keep=1&code=the-code&state=the-state&iss=https%3A%2F%2Fbooks.example',
    );
  });

  it('leaves out a parameter that has no value', () => {
    const url = authorizationResponse('https://client.example/callback', {
      error: 'access_denied',
      state: undefined,
      iss: 'https://books.example',
    });

    expect(url.href).toBe(
      'https://client.example/callback?error=access_denied&iss=https%3A%2F%2Fbooks.example',
    );
  });
});

describe('authorizationParameters', () => {
  it('reads each parameter of an authorization request', () => {
    const result = authorizationParameters(
      new URLSearchParams({
        response_type: 'code',
        client_id: 'https://client.example/client.json',
        redirect_uri: 'https://client.example/callback',
        state: 'the-state',
        code_challenge: CHALLENGE,
        code_challenge_method: 'S256',
        scope: 'read',
        resource: 'https://books.example/mcp',
        ignored: 'x',
      }).toString(),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        responseType: 'code',
        clientId: 'https://client.example/client.json',
        redirectUri: 'https://client.example/callback',
        state: 'the-state',
        codeChallenge: CHALLENGE,
        codeChallengeMethod: 'S256',
        scope: 'read',
        resource: 'https://books.example/mcp',
      },
    });
  });

  it('leaves a parameter the request does not carry undefined', () => {
    const result = authorizationParameters('client_id=x');

    expect(result).toEqual({
      ok: true,
      value: {
        responseType: undefined,
        clientId: 'x',
        redirectUri: undefined,
        state: undefined,
        codeChallenge: undefined,
        codeChallengeMethod: undefined,
        scope: undefined,
        resource: undefined,
      },
    });
  });

  it('reads a query with or without its question mark alike', () => {
    expect(authorizationParameters('?client_id=x')).toEqual(authorizationParameters('client_id=x'));
  });

  it('refuses a request carrying a parameter twice', () => {
    const result = authorizationParameters('client_id=x&state=a&state=b');

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'An authorization request carries each parameter at most once.',
    });
  });

  it('allows a parameter it does not read to appear twice', () => {
    expect(authorizationParameters('client_id=x&extra=a&extra=b').ok).toBe(true);
  });
});

describe('authorizationCodeExpiry', () => {
  it('is 60 seconds after it is issued', () => {
    expect(AUTHORIZATION_CODE_SECONDS).toBe(60);
    expect(authorizationCodeExpiry(new Date('2026-11-07T00:00:00.000Z'))).toEqual(
      new Date('2026-11-07T00:01:00.000Z'),
    );
  });
});

describe('requestedGrant', () => {
  const MCP_URL = 'https://books.example/mcp';
  const asked: AuthorizationParameters = {
    responseType: 'code',
    clientId: 'https://client.example/client.json',
    redirectUri: 'https://client.example/callback',
    state: 'the-state',
    codeChallenge: CHALLENGE,
    codeChallengeMethod: 'S256',
    scope: 'read',
    resource: MCP_URL,
  };

  it('grants the scopes asked for, bound to the PKCE challenge and the resource', () => {
    expect(requestedGrant(asked, MCP_URL)).toEqual({
      ok: true,
      value: { scopes: ['read'], codeChallenge: CHALLENGE, resource: MCP_URL },
    });
  });

  it('refuses a response type other than code as unsupported_response_type', () => {
    expect(requestedGrant({ ...asked, responseType: 'token' }, MCP_URL)).toEqual({
      ok: false,
      error: 'unsupported_response_type',
    });
  });

  it('refuses a request without an S256 PKCE challenge as invalid_request', () => {
    expect(requestedGrant({ ...asked, codeChallengeMethod: 'plain' }, MCP_URL)).toEqual({
      ok: false,
      error: 'invalid_request',
    });
  });

  it('refuses a scope it does not know as invalid_scope', () => {
    expect(requestedGrant({ ...asked, scope: 'admin' }, MCP_URL)).toEqual({
      ok: false,
      error: 'invalid_scope',
    });
  });

  it('refuses a resource other than the MCP URL as invalid_target', () => {
    expect(requestedGrant({ ...asked, resource: 'https://mcp.example.com/mcp' }, MCP_URL)).toEqual({
      ok: false,
      error: 'invalid_target',
    });
  });
});
