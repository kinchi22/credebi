import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  changeEntryFormModeInputSchema,
  entryFormModeSchema,
  languageSchema,
  settingsSchema,
  toSettings,
} from './settings';

describe('entryFormModeSchema', () => {
  it('accepts both Entry form modes', () => {
    expect(entryFormModeSchema.options).toEqual(['two-line', 'multi-line']);
  });

  it('rejects anything else', () => {
    expect(entryFormModeSchema.safeParse('three-line').success).toBe(false);
  });
});

describe('languageSchema', () => {
  it('holds English, Korean and Japanese', () => {
    expect(languageSchema.options).toEqual(['en', 'ko', 'ja']);
  });

  it('rejects a Language the app has no catalogue for, and a region it does not tell apart', () => {
    expect(languageSchema.safeParse('fr').success).toBe(false);
    expect(languageSchema.safeParse('ko-KR').success).toBe(false);
    expect(languageSchema.safeParse('EN').success).toBe(false);
  });

  it('defaults to English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });
});

describe('settingsSchema', () => {
  it('reads Settings holding an Entry form mode', () => {
    expect(settingsSchema.parse({ entryFormMode: 'multi-line' })).toEqual({
      entryFormMode: 'multi-line',
    });
  });

  it('refuses Settings with no Entry form mode', () => {
    expect(settingsSchema.safeParse({}).success).toBe(false);
  });
});

describe('changeEntryFormModeInputSchema', () => {
  it('takes the Entry form mode to change to', () => {
    expect(changeEntryFormModeInputSchema.parse({ entryFormMode: 'two-line' })).toEqual({
      entryFormMode: 'two-line',
    });
  });

  it('refuses a mode that is not an Entry form mode', () => {
    expect(changeEntryFormModeInputSchema.safeParse({ entryFormMode: 'three-line' }).success).toBe(
      false,
    );
  });
});

describe('toSettings', () => {
  it('carries the Entry form mode alone, in a shape the schema accepts', () => {
    const settings = toSettings({ entryFormMode: 'multi-line', extra: 'dropped' } as {
      readonly entryFormMode: 'multi-line';
    });

    expect(settings).toStrictEqual({ entryFormMode: 'multi-line' });
    expect(settingsSchema.parse(settings)).toEqual(settings);
  });
});
