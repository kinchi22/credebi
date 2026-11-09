import { describe, expect, it } from 'vitest';
import { authorizationServerAt, requestOrigin } from './oauth';

describe('requestOrigin', () => {
  it('is the host and protocol a proxy forwarded the request for', () => {
    const headers = new Headers({
      'x-forwarded-host': 'books.example',
      'x-forwarded-proto': 'https',
      host: 'internal:3000',
    });

    expect(requestOrigin(headers, new URL('http://internal:3000/mcp'))).toBe('https://books.example');
  });

  it('is the Host header, on the URL protocol, when nothing forwarded the request', () => {
    const headers = new Headers({ host: 'books.example:8080' });

    expect(requestOrigin(headers, new URL('https://internal/mcp'))).toBe('https://books.example:8080');
  });

  it('is the URL origin when the request names no host', () => {
    expect(requestOrigin(new Headers(), new URL('https://books.example/mcp'))).toBe(
      'https://books.example',
    );
  });

  it('is http on the Host header when there is neither a forwarded protocol nor a URL', () => {
    expect(requestOrigin(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });

  it('names no host when neither the headers nor a URL do', () => {
    expect(requestOrigin(new Headers())).toBe('http://');
  });
});

describe('authorizationServerAt', () => {
  it('issues as the origin and serves MCP at its /mcp', () => {
    expect(authorizationServerAt('https://books.example')).toEqual({
      issuer: 'https://books.example',
      mcpUrl: 'https://books.example/mcp',
    });
  });
});
