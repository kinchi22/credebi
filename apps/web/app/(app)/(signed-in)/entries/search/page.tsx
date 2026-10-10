import { type SearchQuery } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { EntrySearchColdVisit } from '../../../../../components/entry-search-cold-visit';
import { EntrySearchForm } from '../../../../../components/entry-search-form';
import { EntrySearchOutcome } from '../../../../../components/entry-search-results';
import { PAGE_HEADING } from '../../../../../components/text-classes';
import { en } from '../../../../../messages/en';
import { createContext } from '../../../../../server/context';
import { answerEntrySearch } from '../../../../../server/entry-search';
import { ENTRY_SEARCH_PATH, pathWithQuery, signInPath } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { orSignIn } from '../../../../../server/sign-in-redirect';
import { deleteEntry, editEntry } from '../actions';
import { searchDefaultRange } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entrySearch.title,
};

const heading = <h1 className={PAGE_HEADING}>{en.entrySearchPage.heading}</h1>;

type EntrySearchPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function EntrySearchPage({
  searchParams,
}: EntrySearchPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const path = pathWithQuery(ENTRY_SEARCH_PATH, query);
  const caller = createCaller(await createContext());
  if (path === ENTRY_SEARCH_PATH) {
    if (!(await caller.auth.signedIn())) {
      redirect(signInPath(ENTRY_SEARCH_PATH));
    }
    const [{ entryFormMode }, chart] = await Promise.all([
      orSignIn(caller.settings.read(), path),
      orSignIn(caller.accounts.chart(), path),
    ]);
    return (
      <>
        {heading}
        <EntrySearchColdVisit
          search={searchDefaultRange}
          controls={{ chart, entryFormMode, editEntry, deleteEntry }}
        />
      </>
    );
  }

  const [settings, chart, answer] = await Promise.all([
    orSignIn(caller.settings.read(), path),
    orSignIn(caller.accounts.chart(), path),
    answerEntrySearch((criteria) => orSignIn(caller.entries.search(criteria), path), query),
  ]);

  return (
    <>
      {heading}
      <EntrySearchForm criteria={answer.criteria} chart={chart} />
      <EntrySearchOutcome
        answer={answer}
        controls={{ chart, entryFormMode: settings.entryFormMode, editEntry, deleteEntry }}
      />
    </>
  );
}
