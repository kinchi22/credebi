'use client';

import { calendarMonth, type DayRange } from '@repo/core/entries';
import { type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { IncomeStatementForm } from './income-statement-form';
import { IncomeStatementOutcome, IncomeStatementPending } from './income-statement-tables';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultRange = (range: DayRange) => Promise<IncomeStatementAnswer>;

export type IncomeStatementColdVisitProps = {
  readonly show: ShowDefaultRange;
};

export function IncomeStatementColdVisit({ show }: IncomeStatementColdVisitProps): ReactNode {
  const { asked: range, todayKey, answer } = useDefaultAnswer(calendarMonth, show);
  const period = range ?? {};

  return (
    <>
      <IncomeStatementForm key={todayKey} period={period} />
      {answer === undefined ? (
        <IncomeStatementPending />
      ) : (
        <IncomeStatementOutcome
          answer={answer === UNAVAILABLE ? { outcome: UNAVAILABLE, period } : answer}
        />
      )}
    </>
  );
}
