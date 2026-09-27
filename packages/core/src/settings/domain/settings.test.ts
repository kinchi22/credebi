import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('gives a User who never chose Two-line mode', () => {
    expect(DEFAULT_SETTINGS).toEqual({ entryFormMode: 'two-line' });
  });
});
