import { describe, expect, it } from 'vitest';
import {
  hashAccessToken,
  hashAuthorizationCode,
  hashRefreshToken,
  hashSessionToken,
  newAccessToken,
  newAuthorizationCode,
  newRefreshToken,
  newSessionToken,
  pkceChallengeOf,
} from './opaque-token';

describe('newSessionToken', () => {
  it('is 32 random bytes, in a form a cookie carries as it is', () => {
    const token = newSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('is a different token every time', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => newSessionToken()));

    expect(tokens.size).toBe(100);
  });
});

describe('hashSessionToken', () => {
  it('is the SHA-256 of the token, hex encoded', () => {
    expect(hashSessionToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is the same for the same token, so a Session is found again by it', () => {
    const token = newSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});

describe('newAuthorizationCode', () => {
  it('is 32 random bytes, in a form a URL carries as it is', () => {
    const code = newAuthorizationCode();

    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(code, 'base64url')).toHaveLength(32);
  });

  it('is a different code every time', () => {
    const codes = new Set(Array.from({ length: 100 }, () => newAuthorizationCode()));

    expect(codes.size).toBe(100);
  });
});

describe('hashAuthorizationCode', () => {
  it('is the SHA-256 of the code, hex encoded', () => {
    expect(hashAuthorizationCode('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe.each([
  ['newAccessToken', newAccessToken],
  ['newRefreshToken', newRefreshToken],
])('%s', (_, issue) => {
  it('is 32 random bytes, in a form a header and a form carry as it is', () => {
    const token = issue();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('is a different token every time', () => {
    expect(new Set(Array.from({ length: 100 }, () => issue())).size).toBe(100);
  });
});

describe.each([
  ['hashAccessToken', hashAccessToken],
  ['hashRefreshToken', hashRefreshToken],
])('%s', (_, hash) => {
  it('is the SHA-256 of the token, hex encoded', () => {
    expect(hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('pkceChallengeOf', () => {
  it('is the S256 challenge of a verifier, as RFC 7636 computes it', () => {
    expect(pkceChallengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});
