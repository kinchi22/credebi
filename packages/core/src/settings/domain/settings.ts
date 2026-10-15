import { DEFAULT_LANGUAGE, type EntryFormMode, type Language } from '@repo/contracts';

export type Settings = {
  readonly entryFormMode: EntryFormMode;
  readonly language: Language;
};

export const DEFAULT_SETTINGS: Settings = { entryFormMode: 'two-line', language: DEFAULT_LANGUAGE };
