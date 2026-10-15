import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  changeEntryFormModeInputSchema,
  changeLanguageInputSchema,
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
  it('reads Settings holding an Entry form mode and a Language', () => {
    expect(settingsSchema.parse({ entryFormMode: 'multi-line', language: 'ja' })).toEqual({
      entryFormMode: 'multi-line',
      language: 'ja',
    });
  });

  it('refuses Settings with no Entry form mode', () => {
    expect(settingsSchema.safeParse({ language: 'en' }).success).toBe(false);
  });

  it('refuses Settings with no Language, or one the app has no catalogue for', () => {
    expect(settingsSchema.safeParse({ entryFormMode: 'two-line' }).success).toBe(false);
    expect(settingsSchema.safeParse({ entryFormMode: 'two-line', language: 'fr' }).success).toBe(
      false,
    );
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

describe('changeLanguageInputSchema', () => {
  it('takes the Language to change to', () => {
    expect(changeLanguageInputSchema.parse({ language: 'ko' })).toEqual({ language: 'ko' });
  });

  it('refuses a Language the app has no catalogue for', () => {
    expect(changeLanguageInputSchema.safeParse({ language: 'fr' }).success).toBe(false);
    expect(changeLanguageInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('toSettings', () => {
  it('carries the Entry form mode and the Language alone, in a shape the schema accepts', () => {
    const settings = toSettings({ entryFormMode: 'multi-line', language: 'ko', extra: 'dropped' } as {
      readonly entryFormMode: 'multi-line';
      readonly language: 'ko';
    });

    expect(settings).toStrictEqual({ entryFormMode: 'multi-line', language: 'ko' });
    expect(settingsSchema.parse(settings)).toEqual(settings);
  });
});
