import { type EntryFormMode } from '@repo/contracts';
import { cache, type ReactNode } from 'react';
import { createContext } from '../server/context';
import { SIGNED_IN_HOME } from '../server/return-path';
import { createCaller } from '../server/root-router';
import { withSectionFault } from '../server/section-fault-request';
import { orSignIn } from '../server/sign-in-redirect';
import { type EntryFormProps } from './entry-form';
import { EntryList, type EntryControls } from './entry-list';
import { MultiLineEntryForm } from './multi-line-entry-form';
import { TwoLineEntryForm } from './two-line-entry-form';

const FORM_BY_MODE: Readonly<Record<EntryFormMode, (props: EntryFormProps) => ReactNode>> = {
  'two-line': TwoLineEntryForm,
  'multi-line': MultiLineEntryForm,
};

const callerOfRequest = cache(async () => createCaller(await createContext()));

const readOfRequest = async <T,>(
  read: (caller: Awaited<ReturnType<typeof callerOfRequest>>) => Promise<T>,
): Promise<T> => orSignIn(read(await callerOfRequest()), SIGNED_IN_HOME);

const settingsOfRequest = cache(() => readOfRequest((caller) => caller.settings.read()));

const chartOfRequest = cache(() => readOfRequest((caller) => caller.accounts.chart()));

const titlesOfRequest = cache(() => readOfRequest((caller) => caller.entries.titles()));

const logOfRequest = cache(() => readOfRequest((caller) => caller.entries.log()));

type EntriesFormSectionProps = {
  readonly action: EntryFormProps['action'];
};

type EntriesListSectionProps = {
  readonly controls: Pick<EntryControls, 'editEntry' | 'deleteEntry'>;
};

export async function EntriesFormSection({ action }: EntriesFormSectionProps): Promise<ReactNode> {
  const [settings, chart, titles] = await withSectionFault('entries.form', () =>
    Promise.all([settingsOfRequest(), chartOfRequest(), titlesOfRequest()]),
  );
  const EntryForm = FORM_BY_MODE[settings.entryFormMode];
  return <EntryForm action={action} chart={chart} titles={titles} />;
}

export async function EntriesListSection({ controls }: EntriesListSectionProps): Promise<ReactNode> {
  const [settings, chart, titles, entries] = await withSectionFault('entries.list', () =>
    Promise.all([settingsOfRequest(), chartOfRequest(), titlesOfRequest(), logOfRequest()]),
  );
  return (
    <EntryList
      entries={entries}
      controls={{ ...controls, chart, titles, entryFormMode: settings.entryFormMode }}
    />
  );
}
