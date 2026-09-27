import { type EntryFormMode } from '@repo/contracts';

export type Settings = {
  readonly entryFormMode: EntryFormMode;
};

export const DEFAULT_SETTINGS: Settings = { entryFormMode: 'two-line' };
