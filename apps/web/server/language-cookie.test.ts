import { describe, expect, it } from 'vitest';
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_OPTIONS } from './language-cookie';

describe('LANGUAGE_COOKIE', () => {
  it('is the locale cookie ADR-0008 names', () => {
    expect(LANGUAGE_COOKIE).toBe('locale');
  });

  it('is out of reach of scripts, sent over TLS to every page, survives a return from Google, and lasts a year', () => {
    expect(LANGUAGE_COOKIE_OPTIONS).toStrictEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 31_536_000,
    });
  });
});
