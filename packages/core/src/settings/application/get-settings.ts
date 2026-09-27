import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Settings } from '../domain/settings';
import { type SettingsRepository } from '../ports/settings-repository';

export type GetSettingsDependencies = {
  readonly settings: SettingsRepository;
};

export type GetSettings = (auth: AuthContext) => Promise<Result<Settings, DomainError>>;

export function createGetSettings({ settings }: GetSettingsDependencies): GetSettings {
  return async (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    return settings.read(userId.value);
  };
}
