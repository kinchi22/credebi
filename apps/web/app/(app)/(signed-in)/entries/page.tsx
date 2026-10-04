import { type EntryFormMode } from '@repo/contracts';
import { NO_CRITERIA } from '@repo/core';
import { type ReactNode } from 'react';
import { type EntryFormProps } from '../../../../components/entry-form';
import { EntryList } from '../../../../components/entry-list';
import { MultiLineEntryForm } from '../../../../components/multi-line-entry-form';
import { TwoLineEntryForm } from '../../../../components/two-line-entry-form';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { SIGNED_IN_HOME } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';
import { deleteEntry, postEntry } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entriesPage.title,
};

const FORM_BY_MODE: Readonly<Record<EntryFormMode, (props: EntryFormProps) => ReactNode>> = {
  'two-line': TwoLineEntryForm,
  'multi-line': MultiLineEntryForm,
};

export default async function EntriesPage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  const [settings, entries] = await Promise.all([
    orSignIn(caller.settings.read(), SIGNED_IN_HOME),
    orSignIn(caller.entries.search(NO_CRITERIA), SIGNED_IN_HOME),
  ]);
  const EntryForm = FORM_BY_MODE[settings.entryFormMode];

  return (
    <>
      <EntryForm action={postEntry} />
      <EntryList entries={entries} deleteEntry={deleteEntry} />
    </>
  );
}
