import { type SearchQuery } from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { EntrySearchColdVisit } from '../../../../../components/entry-search-cold-visit';
import { EntrySearchForm } from '../../../../../components/entry-search-form';
import { EntrySearchSkeleton } from '../../../../../components/entry-search-results';
import {
  chartOfRequest,
  EntrySearchSection,
  settingsOfRequest,
  titlesOfRequest,
} from '../../../../../components/entry-search-section';
import { LoadingSection } from '../../../../../components/loading-section';
import { PAGE_HEADING } from '../../../../../components/text-classes';
import { createContext } from '../../../../../server/context';
import { criteriaOfQuery } from '../../../../../server/entry-search';
import { ENTRY_SEARCH_PATH, pathWithQuery, signInPath } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { deleteEntry, editEntry } from '../actions';
import { searchDefaultRange } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('entrySearch.title') };
}

type EntrySearchPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function EntrySearchPage({
  searchParams,
}: EntrySearchPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const t = await getTranslations();
  const heading = <h1 className={PAGE_HEADING}>{t('entrySearchPage.heading')}</h1>;
  const path = pathWithQuery(ENTRY_SEARCH_PATH, query);
  if (!(await createCaller(await createContext()).auth.signedIn())) {
    redirect(signInPath(ENTRY_SEARCH_PATH));
  }

  const [chart, titles] = await Promise.all([chartOfRequest(path), titlesOfRequest(path)]);

  if (path === ENTRY_SEARCH_PATH) {
    const { entryFormMode } = await settingsOfRequest(path);
    return (
      <>
        {heading}
        <EntrySearchColdVisit
          search={searchDefaultRange}
          controls={{ chart, titles, entryFormMode, editEntry, deleteEntry }}
        />
      </>
    );
  }

  return (
    <>
      {heading}
      <EntrySearchForm criteria={criteriaOfQuery(query)} chart={chart} titles={titles} />
      <LoadingSection
        key={JSON.stringify(query)}
        name={t('entrySearch.results')}
        skeleton={<EntrySearchSkeleton />}
      >
        <EntrySearchSection query={query} controls={{ editEntry, deleteEntry }} />
      </LoadingSection>
    </>
  );
}
