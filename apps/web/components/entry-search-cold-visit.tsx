'use client';

import { defaultSearchRange, type DayRange } from '@repo/core/entries';
import { useTranslations } from 'next-intl';
import { useCallback, useState, type ReactNode } from 'react';
import { type EntrySearchAnswer } from '../server/entry-search';
import { type DeleteEntryAction } from './delete-entry';
import { type EditEntryAction } from './edit-entry';
import { type EntryControls } from './entry-list';
import { EntrySearchForm } from './entry-search-form';
import { EntrySearchOutcome, EntrySearchSkeleton } from './entry-search-results';
import { RetryingColdVisit } from './retrying-cold-visit';
import { SectionFailure } from './section-error-boundary';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type SearchDefaultRange = (range: DayRange) => Promise<EntrySearchAnswer>;

export type EntrySearchColdVisitProps = {
  readonly search: SearchDefaultRange;
  readonly controls: EntryControls;
};

type AttemptProps = EntrySearchColdVisitProps & { readonly retry: () => void };

function ColdVisitAttempt({ search, controls, retry }: AttemptProps): ReactNode {
  const t = useTranslations();
  const [revision, setRevision] = useState(0);
  const { asked: range, todayKey, answer } = useDefaultAnswer(defaultSearchRange, search, revision);
  const { deleteEntry, editEntry } = controls;
  const deleteAndSearchAgain = useCallback<DeleteEntryAction>(
    async (id) => {
      const deletion = await deleteEntry(id);
      if (deletion.outcome === 'deleted') {
        setRevision((current) => current + 1);
      }
      return deletion;
    },
    [deleteEntry],
  );
  const editAndSearchAgain = useCallback<EditEntryAction>(
    async (id, previous, form) => {
      const edited = await editEntry(id, previous, form);
      if (edited.outcome === 'saved') {
        setRevision((current) => current + 1);
      }
      return edited;
    },
    [editEntry],
  );

  let results: ReactNode;
  if (answer === undefined) {
    results = <EntrySearchSkeleton />;
  } else if (answer === UNAVAILABLE) {
    results = <SectionFailure name={t('entrySearch.results')} retry={retry} />;
  } else {
    results = (
      <EntrySearchOutcome
        answer={answer}
        controls={{ ...controls, deleteEntry: deleteAndSearchAgain, editEntry: editAndSearchAgain }}
      />
    );
  }

  return (
    <>
      <EntrySearchForm
        key={todayKey}
        criteria={range ?? {}}
        chart={controls.chart}
        titles={controls.titles}
      />
      {results}
    </>
  );
}

export function EntrySearchColdVisit({ search, controls }: EntrySearchColdVisitProps): ReactNode {
  return (
    <RetryingColdVisit>
      {(retry) => <ColdVisitAttempt search={search} controls={controls} retry={retry} />}
    </RetryingColdVisit>
  );
}
