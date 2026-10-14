import { eq } from 'drizzle-orm';
import {
  domainError,
  entryFormModeSchema,
  err,
  languageSchema,
  ok,
  type DomainError,
  type EntryFormMode,
  type Language,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { databaseFailure } from '../../auth/adapters/database-failure';
import { type Logger } from '../../logging/ports/logger';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { type SettingsRepository } from '../ports/settings-repository';

export type PostgresSettingsRepository = SettingsRepository & {
  close: () => Promise<void>;
};

export function createPostgresSettingsRepository(
  connectionString: string,
  logger: Logger,
): PostgresSettingsRepository {
  const { database, close } = createDatabase(connectionString);

  const save = async (
    userId: UserId,
    change: Partial<Settings>,
  ): Promise<Result<void, DomainError>> => {
    try {
      await database
        .insert(schema.userSettings)
        .values({ userId, ...DEFAULT_SETTINGS, ...change })
        .onConflictDoUpdate({ target: schema.userSettings.userId, set: change });
      return ok(undefined);
    } catch (error) {
      return databaseFailure(logger, 'settings.save_failed', error, 'The Settings could not be saved.');
    }
  };

  return {
    read: async (userId: UserId): Promise<Result<Settings, DomainError>> => {
      let rows: { readonly entryFormMode: string; readonly language: string }[];
      try {
        rows = await database
          .select({
            entryFormMode: schema.userSettings.entryFormMode,
            language: schema.userSettings.language,
          })
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, userId));
      } catch (error) {
        return databaseFailure(logger, 'settings.read_failed', error, 'The Settings could not be read.');
      }

      const [row] = rows;
      if (row === undefined) {
        return ok(DEFAULT_SETTINGS);
      }

      const entryFormMode = entryFormModeSchema.safeParse(row.entryFormMode);
      const language = languageSchema.safeParse(row.language);
      if (!entryFormMode.success || !language.success) {
        logger.error(
          { event: 'settings.stored_settings_invalid', userId },
          'Stored Settings hold no valid Entry form mode or Language, so they were not read.',
        );
        return err(
          domainError(
            'DEPENDENCY_UNAVAILABLE',
            'The stored Settings hold no valid Entry form mode or Language.',
          ),
        );
      }
      return ok({ entryFormMode: entryFormMode.data, language: language.data });
    },

    saveEntryFormMode: (userId: UserId, entryFormMode: EntryFormMode) =>
      save(userId, { entryFormMode }),

    saveLanguage: (userId: UserId, language: Language) => save(userId, { language }),

    close,
  };
}
