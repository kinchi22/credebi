import { describe, expect, it } from 'vitest';
import {
  ENTRY_SEARCH_PATH,
  REQUESTED_PATH_HEADER,
  pathWithQuery,
  requestedPath,
  returnPath,
  signInPath,
  signInPathFor,
} from './return-path';

describe('returnPath', () => {
  it.each([
    ['/entries', '/entries'],
    ['/entries?day=2026-09-15', '/entries?day=2026-09-15'],
    ['/entries#new', '/entries#new'],
    ['/', '/'],
  ])('keeps a path on this origin: %s', (requested, expected) => {
    expect(returnPath(requested)).toBe(expected);
  });

  it.each([
    ['another site', 'https://evil.test/steal'],
    ['a protocol-relative URL', '//evil.test/steal'],
    ['a path no URL can be made of', '//['],
    ['a backslash browsers read as a slash', '/\\evil.test/steal'],
    ['a relative path', 'entries'],
    ['a script', 'javascript:alert(1)'],
    ['nothing', ''],
    ['no value', undefined],
    ['a value that is not text', ['/entries']],
  ])('lands on the entries page instead of %s', (_case, requested) => {
    expect(returnPath(requested)).toBe('/entries');
  });
});

describe('signInPath', () => {
  it('sends the visitor to sign in, remembering where they were going', () => {
    expect(signInPath('/entries?day=2026-09-15')).toBe(
      '/sign-in?returnTo=%2Fentries%3Fday%3D2026-09-15',
    );
  });

  it('is read back by returnPath as the path it was given', () => {
    const query = new URL(signInPath('/entries'), 'http://app.test').searchParams;

    expect(returnPath(query.get('returnTo'))).toBe('/entries');
  });
});

describe('pathWithQuery', () => {
  it('is the path alone when nothing was asked for', () => {
    expect(pathWithQuery('/entries/search', {})).toBe('/entries/search');
  });

  it('carries the criteria that were asked for', () => {
    expect(pathWithQuery('/entries/search', { from: '2026-06-01', to: '2026-06-30' })).toBe(
      '/entries/search?from=2026-06-01&to=2026-06-30',
    );
  });

  it('leaves out a parameter that was not given', () => {
    expect(pathWithQuery('/entries/search', { from: '2026-06-01', to: undefined })).toBe(
      '/entries/search?from=2026-06-01',
    );
  });

  it('keeps a parameter given twice given twice', () => {
    expect(pathWithQuery('/entries/search', { from: ['2026-06-01', '2026-07-01'] })).toBe(
      '/entries/search?from=2026-06-01&from=2026-07-01',
    );
  });

  it('escapes what it carries, so a criterion cannot add a parameter', () => {
    expect(pathWithQuery('/entries/search', { memo: 'a&b=c' })).toBe(
      '/entries/search?memo=a%26b%3Dc',
    );
  });

  it('is read back by returnPath as the path and query it was given', () => {
    expect(returnPath(pathWithQuery(ENTRY_SEARCH_PATH, { from: '2026-06-01' }))).toBe(
      '/entries/search?from=2026-06-01',
    );
  });
});

describe('requestedPath', () => {
  it('is the path and query of the request', () => {
    expect(requestedPath(new URL('http://app.test/entries/search?from=2026-06-01'))).toBe(
      '/entries/search?from=2026-06-01',
    );
  });

  it('is the path alone when the request has no query', () => {
    expect(requestedPath(new URL('http://app.test/settings'))).toBe('/settings');
  });
});

describe('signInPathFor', () => {
  const forwarded = (value: string): Headers =>
    new Headers({ [REQUESTED_PATH_HEADER]: value });

  it('sends the visitor to sign in, remembering the page the request asked for', () => {
    expect(signInPathFor(forwarded('/entries/search?from=2026-06-01'))).toBe(
      '/sign-in?returnTo=%2Fentries%2Fsearch%3Ffrom%3D2026-06-01',
    );
  });

  it('returns to the entries page when the request carries no path', () => {
    expect(signInPathFor(new Headers())).toBe('/sign-in?returnTo=%2Fentries');
  });

  it('returns to the entries page when the forwarded path leaves this origin', () => {
    expect(signInPathFor(forwarded('//evil.test/steal'))).toBe('/sign-in?returnTo=%2Fentries');
  });
});
