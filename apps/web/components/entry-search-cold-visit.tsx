'use client';

import { defaultSearchRange, type DayRange } from '@repo/core/entries';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { type EntrySearchAnswer } from '../server/entry-search';
import { EntrySearchForm } from './entry-search-form';
import { EntrySearchOutcome, EntrySearchPending } from './entry-search-results';

export type SearchDefaultRange = (range: DayRange) => Promise<EntrySearchAnswer>;

export type EntrySearchColdVisitProps = {
  readonly search: SearchDefaultRange;
};

const twoDigits = (value: number): string => String(value).padStart(2, '0');

function todayInTheBrowser(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
}

const subscribeToNothing = (): (() => void) => () => undefined;

const todayUnknownOnTheServer = (): undefined => undefined;

export function EntrySearchColdVisit({ search }: EntrySearchColdVisitProps): ReactNode {
  const today = useSyncExternalStore(subscribeToNothing, todayInTheBrowser, todayUnknownOnTheServer);
  const range = useMemo(() => (today === undefined ? undefined : defaultSearchRange(today)), [today]);
  const [answer, setAnswer] = useState<EntrySearchAnswer>();

  useEffect(() => {
    if (range === undefined) {
      return undefined;
    }
    let current = true;
    void search(range).then((found) => {
      if (current) {
        setAnswer(found);
      }
    });
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
      {answer === undefined ? <EntrySearchPending /> : <EntrySearchOutcome answer={answer} />}
    </>
  );
}
