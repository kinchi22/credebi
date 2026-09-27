import { describe, expect, it } from 'vitest';
import {
  changeEntryFormModeInputSchema,
  entryFormModeSchema,
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
