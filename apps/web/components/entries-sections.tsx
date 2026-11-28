import { type EntryFormMode } from '@repo/contracts';
import { cache, type ReactNode } from 'react';
import { SIGNED_IN_HOME } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest, type RequestCaller } from '../server/signed-in-read-request';
import { type EntryFormProps } from './entry-form';
import { EntryList, type EntryControls } from './entry-list';
import { MultiLineEntryForm } from './multi-line-entry-form';
import { TwoLineEntryForm } from './two-line-entry-form';

const FORM_BY_MODE: Readonly<Record<EntryFormMode, (props: EntryFormProps) => ReactNode>> = {
  'two-line': TwoLineEntryForm,
  'multi-line': MultiLineEntryForm,
};

const readEntries = <T,>(read: (caller: RequestCaller) => Promise<T>): Promise<T> =>
  readOfRequest(SIGNED_IN_HOME, read);

const settingsOfRequest = cache(() => readEntries((caller) => caller.settings.read()));

const chartOfRequest = cache(() => readEntries((caller) => caller.accounts.chart()));

const titlesOfRequest = cache(() => readEntries((caller) => caller.entries.titles()));

const logOfRequest = cache(() => readEntries((caller) => caller.entries.log()));

export async function EntriesFormSection({ action }: Pick<EntryFormProps, 'action'>): Promise<ReactNode> {
  const [settings, chart, titles] = await withSectionFault('entries.form', () =>
    Promise.all([settingsOfRequest(), chartOfRequest(), titlesOfRequest()]),
  );
  const EntryForm = FORM_BY_MODE[settings.entryFormMode];
  return <EntryForm action={action} chart={chart} titles={titles} />;
}

export async function EntriesListSection({
  controls,
}: {
  readonly controls: Pick<EntryControls, 'editEntry' | 'deleteEntry'>;
}): Promise<ReactNode> {
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
