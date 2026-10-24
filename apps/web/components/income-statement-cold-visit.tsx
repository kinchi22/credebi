'use client';

import { calendarMonth, type DayRange } from '@repo/core/entries';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { IncomeStatementForm } from './income-statement-form';
import { IncomeStatementOutcome, IncomeStatementPending } from './income-statement-tables';
import { useBrowserToday } from './use-browser-today';

export type ShowDefaultRange = (range: DayRange) => Promise<IncomeStatementAnswer>;

export type IncomeStatementColdVisitProps = {
  readonly show: ShowDefaultRange;
};

export function IncomeStatementColdVisit({ show }: IncomeStatementColdVisitProps): ReactNode {
  const today = useBrowserToday();
  const range = useMemo(() => (today === undefined ? undefined : calendarMonth(today)), [today]);
  const [answer, setAnswer] = useState<IncomeStatementAnswer>();

  useEffect(() => {
    if (range === undefined) {
      return undefined;
    }
    let current = true;
    show(range).then(
      (shown) => {
        if (current) {
          setAnswer(shown);
        }
      },
      () => {
        if (current) {
          setAnswer({ outcome: 'unavailable', period: range });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [range, show]);

  return (
    <>
      <IncomeStatementForm
        key={range === undefined ? 'today-unknown' : `${range.from}/${range.to}`}
        period={range ?? {}}
      />
      {answer === undefined ? <IncomeStatementPending /> : <IncomeStatementOutcome answer={answer} />}
    </>
  );
}
