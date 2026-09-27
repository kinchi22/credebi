import { NO_CRITERIA } from '@repo/core';
import { type ReactNode } from 'react';
import { EntryList } from '../../../../components/entry-list';
import { TwoLineEntryForm } from '../../../../components/two-line-entry-form';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';
import { postEntry } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entriesPage.title,
};

export default async function EntriesPage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  const entries = await orSignIn(caller.entries.search(NO_CRITERIA), '/entries');

  return (
    <>
      <TwoLineEntryForm action={postEntry} />
      <EntryList entries={entries} />
    </>
  );
}
