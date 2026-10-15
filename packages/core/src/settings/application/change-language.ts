import { type DomainError, type Language, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type SettingsRepository } from '../ports/settings-repository';

export type ChangeLanguageDependencies = {
  readonly settings: SettingsRepository;
};

export type ChangeLanguage = (
  auth: AuthContext,
  language: Language,
) => Promise<Result<void, DomainError>>;

export function createChangeLanguage({ settings }: ChangeLanguageDependencies): ChangeLanguage {
  return async (auth, language) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    return settings.saveLanguage(userId.value, language);
  };
}
