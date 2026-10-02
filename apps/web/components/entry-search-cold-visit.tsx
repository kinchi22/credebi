'use client';

import { defaultSearchRange, type DayRange } from '@repo/core/entries';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { type EntrySearchAnswer } from '../server/entry-search';
import { useBrowserToday } from './browser-today';
import { EntrySearchForm } from './entry-search-form';
import { EntrySearchOutcome, EntrySearchPending } from './entry-search-results';
import { DANGER_TEXT } from './text-classes';

export type SearchDefaultRange = (range: DayRange) => Promise<EntrySearchAnswer>;

export type EntrySearchColdVisitProps = {
  readonly search: SearchDefaultRange;
};

const UNAVAILABLE = 'unavailable';

type ColdVisitAnswer = EntrySearchAnswer | typeof UNAVAILABLE;

function ColdVisitOutcome({ answer }: { readonly answer: ColdVisitAnswer | undefined }): ReactNode {
  if (answer === undefined) {
    return <EntrySearchPending />;
  }
  if (answer === UNAVAILABLE) {
    return (
      <p role="alert" className={DANGER_TEXT}>
        {en.entrySearch.unavailable}
      </p>
    );
  }
  return <EntrySearchOutcome answer={answer} />;
}

export function EntrySearchColdVisit({ search }: EntrySearchColdVisitProps): ReactNode {
  const today = useBrowserToday();
  const range = useMemo(() => (today === undefined ? undefined : defaultSearchRange(today)), [today]);
  const [answer, setAnswer] = useState<ColdVisitAnswer>();

  useEffect(() => {
    if (range === undefined) {
      return undefined;
    }
    let current = true;
    search(range).then(
      (found) => {
        if (current) {
          setAnswer(found);
        }
      },
      () => {
        if (current) {
          setAnswer(UNAVAILABLE);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [range, search]);

  return (
    <>
      <EntrySearchForm
        key={range === undefined ? 'today-unknown' : `${range.from}/${range.to}`}
        criteria={range ?? {}}
      />
      <ColdVisitOutcome answer={answer} />
    </>
  );
}
