import { describe, expect, it } from 'vitest';
import { configForLanguage, requestConfig } from './i18n-request';

describe('the request config', () => {
  it('serves English, with the English catalogue, to a request that names no Language', () => {
    const config = requestConfig({});

    expect(config.locale).toBe('en');
    expect(config.messages).toMatchObject({ app: { name: 'Credebi' }, sides: { debit: 'Debit' } });
  });

  it('serves the Language the cookie holds, with its catalogue', () => {
    const config = requestConfig({ cookie: 'ja', acceptLanguage: 'ko' });

    expect(config.locale).toBe('ja');
    expect(config.messages).toMatchObject({ language: { label: '\u8A00\u8A9E' } });
  });

  it('serves the Language the browser prefers when no cookie names one, with its catalogue', () => {
    const config = requestConfig({ acceptLanguage: 'ko-KR,ko;q=0.9' });

    expect(config.locale).toBe('ko');
    expect(config.messages).toMatchObject({ language: { label: '\uC5B8\uC5B4' } });
  });

  it('serves a Language named outright, with its catalogue, whatever the request holds', () => {
    const config = configForLanguage('ko');

    expect(config.locale).toBe('ko');
    expect(config.messages).toMatchObject({ language: { label: '\uC5B8\uC5B4' } });
  });
});
