import { z } from 'zod';

export const entryFormModeSchema = z.enum(['two-line', 'multi-line']);
export type EntryFormMode = z.infer<typeof entryFormModeSchema>;

export const settingsSchema = z.object({
  entryFormMode: entryFormModeSchema,
});

export type SettingsOutput = z.infer<typeof settingsSchema>;

export const changeEntryFormModeInputSchema = z.object({
  entryFormMode: entryFormModeSchema,
});

export type ChangeEntryFormModeInput = z.infer<typeof changeEntryFormModeInputSchema>;

export function toSettings(settings: { readonly entryFormMode: EntryFormMode }): SettingsOutput {
  return { entryFormMode: settings.entryFormMode };
}
