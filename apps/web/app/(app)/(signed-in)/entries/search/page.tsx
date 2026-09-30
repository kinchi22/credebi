import { type SearchQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { REFUSAL_TEXT } from '../../../../../components/control-classes';
import { EntrySearchForm } from '../../../../../components/entry-search-form';
import { EntrySearchResults } from '../../../../../components/entry-search-results';
import { en } from '../../../../../messages/en';
import { createContext } from '../../../../../server/context';
import { answerEntrySearch } from '../../../../../server/entry-search';
import { ENTRY_SEARCH_PATH, pathWithQuery } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { orSignIn } from '../../../../../server/sign-in-redirect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entrySearch.title,
};

type EntrySearchPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function EntrySearchPage({
  searchParams,
}: EntrySearchPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const caller = createCaller(await createContext());
  const answer = await answerEntrySearch(
    (criteria) =>
      orSignIn(caller.entries.search(criteria), pathWithQuery(ENTRY_SEARCH_PATH, query)),
    query,
  );

  return (
    <>
      <EntrySearchForm criteria={answer.criteria} />
      {answer.outcome === 'refused' ? (
        <p role="alert" className={REFUSAL_TEXT}>
          {en.entrySearch.refused}
        </p>
      ) : (
        <EntrySearchResults entries={answer.entries} />
      )}
    </>
  );
}
