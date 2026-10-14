export const LANGUAGE_COOKIE = 'locale';

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export const LANGUAGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: YEAR_SECONDS,
} as const;
