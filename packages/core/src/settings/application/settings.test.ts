import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type DomainError,
  type EntryFormMode,
  type Language,
  type Result,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { type SettingsRepository } from '../ports/settings-repository';
import { createChangeEntryFormMode, type ChangeEntryFormMode } from './change-entry-form-mode';
import { createChangeLanguage, type ChangeLanguage } from './change-language';
import { createGetSettings, type GetSettings } from './get-settings';

function inMemorySettings(): SettingsRepository {
  const stored = new Map<UserId, Settings>();
  return {
    read: (userId: UserId): Promise<Result<Settings, DomainError>> =>
      Promise.resolve(ok(stored.get(userId) ?? DEFAULT_SETTINGS)),
    saveEntryFormMode: (
      userId: UserId,
      entryFormMode: EntryFormMode,
    ): Promise<Result<void, DomainError>> => {
      stored.set(userId, { ...(stored.get(userId) ?? DEFAULT_SETTINGS), entryFormMode });
      return Promise.resolve(ok(undefined));
    },
    saveLanguage: (userId: UserId, language: Language): Promise<Result<void, DomainError>> => {
      stored.set(userId, { ...(stored.get(userId) ?? DEFAULT_SETTINGS), language });
      return Promise.resolve(ok(undefined));
    },
  };
}

const unavailableSettings: SettingsRepository = {
  read: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  saveEntryFormMode: () =>
    Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  saveLanguage: () =>
    Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
};

const ADA: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a1' as UserId };
const GRACE: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a2' as UserId };

function useCases(settings: SettingsRepository): {
  getSettings: GetSettings;
  changeEntryFormMode: ChangeEntryFormMode;
  changeLanguage: ChangeLanguage;
} {
  return {
    getSettings: createGetSettings({ settings }),
    changeEntryFormMode: createChangeEntryFormMode({ settings }),
    changeLanguage: createChangeLanguage({ settings }),
  };
}

describe('createGetSettings', () => {
  it('reads Two-line mode and English for a User who never changed their Settings', async () => {
    const { getSettings } = useCases(inMemorySettings());

    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'two-line', language: 'en' }));
  });

  it('refuses to read Settings for nobody, as unauthenticated', async () => {
    const { getSettings } = useCases(inMemorySettings());

    const read = await getSettings(SIGNED_OUT);

    expect(!read.ok && read.error.code).toBe('UNAUTHENTICATED');
  });

  it('reports a failed read as its own result', async () => {
    const { getSettings } = useCases(unavailableSettings);

    const read = await getSettings(ADA);

    expect(!read.ok && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});

describe('createChangeEntryFormMode', () => {
  it("keeps the chosen Entry form mode as the signed-in User's", async () => {
    const { getSettings, changeEntryFormMode } = useCases(inMemorySettings());

    expect(await changeEntryFormMode(ADA, 'multi-line')).toEqual(ok(undefined));

    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'multi-line', language: 'en' }));
    expect(await getSettings(GRACE)).toEqual(ok({ entryFormMode: 'two-line', language: 'en' }));
  });

  it('changes the mode back again', async () => {
    const { getSettings, changeEntryFormMode } = useCases(inMemorySettings());

    await changeEntryFormMode(ADA, 'multi-line');
    await changeEntryFormMode(ADA, 'two-line');

    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'two-line', language: 'en' }));
  });

  it('refuses to change the mode for nobody, as unauthenticated, and changes nothing', async () => {
    const settings = inMemorySettings();
    const { changeEntryFormMode } = useCases(settings);

    const changed = await changeEntryFormMode(SIGNED_OUT, 'multi-line');

    expect(!changed.ok && changed.error.code).toBe('UNAUTHENTICATED');
    expect(await settings.read(ADA.userId as UserId)).toEqual(ok(DEFAULT_SETTINGS));
  });

  it('reports a failed save as its own result', async () => {
    const { changeEntryFormMode } = useCases(unavailableSettings);

    const changed = await changeEntryFormMode(ADA, 'multi-line');

    expect(!changed.ok && changed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});

describe('createChangeLanguage', () => {
  it("keeps the chosen Language as the signed-in User's, leaving their Entry form mode", async () => {
    const { getSettings, changeEntryFormMode, changeLanguage } = useCases(inMemorySettings());
    await changeEntryFormMode(ADA, 'multi-line');

    expect(await changeLanguage(ADA, 'ko')).toEqual(ok(undefined));

    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'multi-line', language: 'ko' }));
    expect(await getSettings(GRACE)).toEqual(ok({ entryFormMode: 'two-line', language: 'en' }));
  });

  it('changes the Language again, to another and back to English', async () => {
    const { getSettings, changeLanguage } = useCases(inMemorySettings());

    await changeLanguage(ADA, 'ja');
    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'two-line', language: 'ja' }));

    await changeLanguage(ADA, 'en');
    expect(await getSettings(ADA)).toEqual(ok({ entryFormMode: 'two-line', language: 'en' }));
  });

  it('refuses to change the Language for nobody, as unauthenticated, and changes nothing', async () => {
    const settings = inMemorySettings();
    const { changeLanguage } = useCases(settings);

    const changed = await changeLanguage(SIGNED_OUT, 'ja');

    expect(!changed.ok && changed.error.code).toBe('UNAUTHENTICATED');
    expect(await settings.read(ADA.userId as UserId)).toEqual(ok(DEFAULT_SETTINGS));
  });

  it('reports a failed save as its own result', async () => {
    const { changeLanguage } = useCases(unavailableSettings);

    const changed = await changeLanguage(ADA, 'ko');

    expect(!changed.ok && changed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
