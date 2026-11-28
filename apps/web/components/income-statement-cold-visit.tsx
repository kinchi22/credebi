'use client';

import { calendarMonth, type DayRange } from '@repo/core/entries';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { IncomeStatementForm } from './income-statement-form';
import { IncomeStatementSkeleton } from './income-statement-skeletons';
import { IncomeStatementOutcome } from './income-statement-tables';
import { SectionFailure } from './section-error-boundary';
import { type KeepCollapsed } from './statement-group';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultRange = (range: DayRange) => Promise<IncomeStatementAnswer>;

export type IncomeStatementColdVisitProps = {
  readonly show: ShowDefaultRange;
  readonly keep: KeepCollapsed;
};

type AttemptProps = IncomeStatementColdVisitProps & { readonly retry: () => void };

function ColdVisitAttempt({ show, keep, retry }: AttemptProps): ReactNode {
  const t = useTranslations();
  const { asked: range, todayKey, answer } = useDefaultAnswer(calendarMonth, show);

  let report: ReactNode;
  if (answer === undefined) {
    report = <IncomeStatementSkeleton />;
  } else if (answer === UNAVAILABLE || answer.outcome === 'unavailable') {
    report = <SectionFailure name={t('incomeStatementPage.title')} retry={retry} />;
  } else {
    report = <IncomeStatementOutcome answer={answer} keep={keep} />;
  }

  return (
    <>
      <IncomeStatementForm key={todayKey} period={range ?? {}} />
      {report}
    </>
  );
}

export function IncomeStatementColdVisit({ show, keep }: IncomeStatementColdVisitProps): ReactNode {
  const [attempt, setAttempt] = useState(0);
  return (
    <ColdVisitAttempt
      key={attempt}
      show={show}
      keep={keep}
      retry={() => {
        setAttempt((current) => current + 1);
      }}
    />
  );
}
