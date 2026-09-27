import { type DomainError, type EntryFormMode, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type SettingsRepository } from '../ports/settings-repository';

export type ChangeEntryFormModeDependencies = {
  readonly settings: SettingsRepository;
};

export type ChangeEntryFormMode = (
  auth: AuthContext,
  entryFormMode: EntryFormMode,
) => Promise<Result<void, DomainError>>;

export function createChangeEntryFormMode({
  settings,
}: ChangeEntryFormModeDependencies): ChangeEntryFormMode {
  return async (auth, entryFormMode) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    return settings.saveEntryFormMode(userId.value, entryFormMode);
  };
}
