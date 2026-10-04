import { type PostedEntry } from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { type EntrySearchAnswer } from '../server/entry-search';
import { type DeleteEntryAction } from './delete-entry';
import { EntryList } from './entry-list';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

type ResultsRegionProps = {
  readonly busy: boolean;
  readonly children: ReactNode;
};

function ResultsRegion({ busy, children }: ResultsRegionProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} aria-busy={busy} className="flex flex-col gap-2">
      <h2
        id={titleId}
        className={`${typeClasses.label} text-text-muted`}
      >
        {en.entrySearch.results}
      </h2>
      {children}
    </section>
  );
}

export type EntrySearchResultsProps = {
  readonly entries: readonly PostedEntry[];
  readonly deleteEntry: DeleteEntryAction;
};

export function EntrySearchResults({ entries, deleteEntry }: EntrySearchResultsProps): ReactNode {
  return (
    <ResultsRegion busy={false}>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{en.entrySearch.nothingMatched}</p>
      ) : (
        <EntryList entries={entries} deleteEntry={deleteEntry} />
      )}
    </ResultsRegion>
  );
}

export function EntrySearchPending(): ReactNode {
  return (
    <ResultsRegion busy>
      <p role="status" className={MUTED_TEXT}>
        {en.entrySearch.searching}
      </p>
    </ResultsRegion>
  );
}

export type EntrySearchOutcomeProps = {
  readonly answer: EntrySearchAnswer;
  readonly deleteEntry: DeleteEntryAction;
};

export function EntrySearchOutcome({ answer, deleteEntry }: EntrySearchOutcomeProps): ReactNode {
  return answer.outcome === 'refused' ? (
    <p role="alert" className={DANGER_TEXT}>
      {en.entrySearch.refused}
    </p>
  ) : (
    <EntrySearchResults entries={answer.entries} deleteEntry={deleteEntry} />
  );
}
