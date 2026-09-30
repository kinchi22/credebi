import { type PostedEntry } from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { MUTED_TEXT } from './control-classes';
import { EntryList } from './entry-list';

export type EntrySearchResultsProps = {
  readonly entries: readonly PostedEntry[];
};

export function EntrySearchResults({ entries }: EntrySearchResultsProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2
        id={titleId}
        className={`${typeClasses.label} text-text-muted`}
      >
        {en.entrySearch.results}
      </h2>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{en.entrySearch.nothingMatched}</p>
      ) : (
        <EntryList entries={entries} />
      )}
    </section>
  );
}
