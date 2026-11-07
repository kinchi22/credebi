import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config } from './proxy';

const runsOn = (path: string): boolean =>
  unstable_doesMiddlewareMatch({ config, url: `https://books.example${path}` });

describe('proxy', () => {
  it.each([
    '/mcp',
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-authorization-server',
  ])('leaves %s alone', (path) => {
    expect(runsOn(path)).toBe(false);
  });

  it.each(['/', '/entries', '/mcp-guide', '/mcpx/entries', '/sign-in', '/auth/callback/google'])(
    'runs on %s',
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );
});
