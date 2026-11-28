import { type SearchQuery } from '@repo/contracts';
import { cache, type ReactNode } from 'react';
import { answerEntrySearch } from '../server/entry-search';
import { ENTRY_SEARCH_PATH, pathWithQuery } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest } from '../server/signed-in-read-request';
import { type EntryControls } from './entry-list';
import { EntrySearchOutcome } from './entry-search-results';

export const settingsOfRequest = cache((path: string) =>
  readOfRequest(path, (caller) => caller.settings.read()),
);

export const chartOfRequest = cache((path: string) =>
  readOfRequest(path, (caller) => caller.accounts.chart()),
);

export const titlesOfRequest = cache((path: string) =>
  readOfRequest(path, (caller) => caller.entries.titles()),
);

export type EntrySearchSectionProps = {
  readonly query: SearchQuery;
  readonly controls: Pick<EntryControls, 'editEntry' | 'deleteEntry'>;
};

export async function EntrySearchSection({ query, controls }: EntrySearchSectionProps): Promise<ReactNode> {
  const path = pathWithQuery(ENTRY_SEARCH_PATH, query);
  const [settings, chart, titles, answer] = await withSectionFault('entry-search.results', () =>
    Promise.all([
      settingsOfRequest(path),
      chartOfRequest(path),
      titlesOfRequest(path),
      answerEntrySearch((criteria) => readOfRequest(path, (caller) => caller.entries.search(criteria)), query),
    ]),
  );
  return (
    <EntrySearchOutcome
      answer={answer}
      controls={{ ...controls, chart, titles, entryFormMode: settings.entryFormMode }}
    />
  );
}
