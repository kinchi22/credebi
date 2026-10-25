'use client';

import { useTranslations } from 'next-intl';
import { defaultSearchRange, type DayRange } from '@repo/core/entries';
import { useCallback, useState, type ReactNode } from 'react';
import { type EntrySearchAnswer } from '../server/entry-search';
import { type DeleteEntryAction } from './delete-entry';
import { type EditEntryAction } from './edit-entry';
import { type EntryControls } from './entry-list';
import { EntrySearchForm } from './entry-search-form';
import { EntrySearchOutcome, EntrySearchPending } from './entry-search-results';
import { DANGER_TEXT } from './text-classes';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type SearchDefaultRange = (range: DayRange) => Promise<EntrySearchAnswer>;

export type EntrySearchColdVisitProps = {
  readonly search: SearchDefaultRange;
  readonly controls: EntryControls;
};

type ColdVisitAnswer = EntrySearchAnswer | typeof UNAVAILABLE;

function ColdVisitOutcome({
  answer,
  controls,
}: {
  readonly answer: ColdVisitAnswer | undefined;
  readonly controls: EntryControls;
}): ReactNode {
  const t = useTranslations();
  if (answer === undefined) {
    return <EntrySearchPending />;
  }
  if (answer === UNAVAILABLE) {
    return (
      <p role="alert" className={DANGER_TEXT}>
        {t('entrySearch.unavailable')}
      </p>
    );
  }
  return <EntrySearchOutcome answer={answer} controls={controls} />;
}

export function EntrySearchColdVisit({ search, controls }: EntrySearchColdVisitProps): ReactNode {
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

  return (
    <>
      <EntrySearchForm
        key={todayKey}
        criteria={range ?? {}}
        chart={controls.chart}
        titles={controls.titles}
      />
      <ColdVisitOutcome
        answer={answer}
        controls={{ ...controls, deleteEntry: deleteAndSearchAgain, editEntry: editAndSearchAgain }}
      />
    </>
  );
}
