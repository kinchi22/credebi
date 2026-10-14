import { describe, expect, it } from 'vitest';
import { requestConfig } from './i18n-request';

describe('the request config', () => {
  it('resolves every request to English, with the English catalogue', async () => {
    const config = await requestConfig();

    expect(config.locale).toBe('en');
    expect(config.messages).toMatchObject({ app: { name: 'Credebi' }, sides: { debit: 'Debit' } });
  });
});
