import { describe, expect, it } from 'vitest';
import { resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it('takes the Language the cookie holds, whatever the browser prefers', () => {
    expect(resolveLanguage({ cookie: 'ja', acceptLanguage: 'ko-KR,ko;q=0.9' })).toBe('ja');
    expect(resolveLanguage({ cookie: 'en', acceptLanguage: 'ja' })).toBe('en');
    expect(resolveLanguage({ cookie: 'ko' })).toBe('ko');
  });

  it('passes over a cookie that holds no Language, to the browser', () => {
    expect(resolveLanguage({ cookie: 'fr', acceptLanguage: 'ja' })).toBe('ja');
    expect(resolveLanguage({ cookie: 'ko-KR', acceptLanguage: 'ja' })).toBe('ja');
    expect(resolveLanguage({ cookie: '', acceptLanguage: 'ko' })).toBe('ko');
  });

  it('reads the browser when there is no cookie', () => {
    expect(resolveLanguage({ acceptLanguage: 'ko' })).toBe('ko');
    expect(resolveLanguage({ acceptLanguage: 'ja' })).toBe('ja');
  });

  it('takes a Language by its primary subtag, whatever the region or case', () => {
    expect(resolveLanguage({ acceptLanguage: 'ko-KR,ko;q=0.9' })).toBe('ko');
    expect(resolveLanguage({ acceptLanguage: 'ja-JP' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'JA-jp' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'en-GB,ko;q=0.5' })).toBe('en');
    expect(resolveLanguage({ acceptLanguage: 'fr;q=0.9,KO-kr;q=0.5' })).toBe('ko');
  });

  it('takes the first Language the browser lists that the app has, in its order of preference', () => {
    expect(resolveLanguage({ acceptLanguage: 'fr-CA,fr;q=0.9,ja;q=0.8,ko;q=0.7,en;q=0.6' })).toBe(
      'ja',
    );
    expect(resolveLanguage({ acceptLanguage: 'de-DE,de;q=0.9,ko-KR;q=0.8,ja;q=0.7' })).toBe('ko');
  });

  it('orders the languages by their weight, not where they stand in the header', () => {
    expect(resolveLanguage({ acceptLanguage: 'ko;q=0.2,ja;q=0.8' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;q=0.5,ja' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ja;q=0.5, ko;q=0.5' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;q=0.9,ja;q=1' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;Q=0.1,ja;q=0.5' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;Q=0.5' })).toBe('ko');
  });

  it('never takes a language the browser refuses with a weight of zero', () => {
    expect(resolveLanguage({ acceptLanguage: 'ko;q=0,ja;q=0.1' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;q=0.000' })).toBe('en');
  });

  it('skips the wildcard and any range it cannot read, and keeps reading', () => {
    expect(resolveLanguage({ acceptLanguage: '*,ja;q=0.5' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'k o,;;,ko;q=abc,ja;q=0.3' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;q=2,ja;q=0.1' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;q=-1,ja;q=0.1' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'kor,ja;q=0.1' })).toBe('ja');
    expect(resolveLanguage({ acceptLanguage: 'ko;level=1;q=0.4,ja;q=0.3' })).toBe('ko');
  });

  it('falls back to English for a browser that prefers only languages the app does not have', () => {
    expect(resolveLanguage({ acceptLanguage: 'fr-FR,fr;q=0.9,de;q=0.8' })).toBe('en');
  });

  it('falls back to English for a malformed header, an empty one or none', () => {
    expect(resolveLanguage({ acceptLanguage: ';;;===,,,' })).toBe('en');
    expect(resolveLanguage({ acceptLanguage: '' })).toBe('en');
    expect(resolveLanguage({ acceptLanguage: null })).toBe('en');
    expect(resolveLanguage({})).toBe('en');
  });
});
