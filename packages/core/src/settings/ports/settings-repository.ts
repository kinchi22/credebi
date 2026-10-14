import {
  type DomainError,
  type EntryFormMode,
  type Language,
  type Result,
  type UserId,
} from '@repo/contracts';
import { type Settings } from '../domain/settings';

export type SettingsRepository = {
  readonly read: (userId: UserId) => Promise<Result<Settings, DomainError>>;
  readonly saveEntryFormMode: (
    userId: UserId,
    entryFormMode: EntryFormMode,
  ) => Promise<Result<void, DomainError>>;
  readonly saveLanguage: (userId: UserId, language: Language) => Promise<Result<void, DomainError>>;
};
