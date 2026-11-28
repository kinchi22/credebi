'use client';

import { defaultTrendRange, type MonthRange } from '@repo/core/entries';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { type AssetsAndLiabilitiesTrendAnswer } from '../server/assets-and-liabilities-trend';
import { type ShownLines } from './assets-and-liabilities-trend-chart';
import { AssetsAndLiabilitiesTrendForm } from './assets-and-liabilities-trend-form';
import {
  AssetsAndLiabilitiesTrendOutcome,
  AssetsAndLiabilitiesTrendSkeleton,
} from './assets-and-liabilities-trend-outcome';
import { SectionFailure } from './section-error-boundary';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultTrendRange = (range: MonthRange) => Promise<AssetsAndLiabilitiesTrendAnswer>;

export type AssetsAndLiabilitiesTrendColdVisitProps = {
  readonly show: ShowDefaultTrendRange;
  readonly lines: ShownLines;
};

type AttemptProps = AssetsAndLiabilitiesTrendColdVisitProps & { readonly retry: () => void };

function ColdVisitAttempt({ show, lines, retry }: AttemptProps): ReactNode {
  const t = useTranslations();
  const { asked, todayKey, answer } = useDefaultAnswer(defaultTrendRange, show);

  let report: ReactNode;
  if (answer === undefined) {
    report = <AssetsAndLiabilitiesTrendSkeleton />;
  } else if (answer === UNAVAILABLE || answer.outcome === 'unavailable') {
    report = <SectionFailure name={t('assetsAndLiabilitiesTrendPage.title')} retry={retry} />;
  } else {
    report = <AssetsAndLiabilitiesTrendOutcome answer={answer} lines={lines} />;
  }

  return (
    <>
      <AssetsAndLiabilitiesTrendForm key={todayKey} range={asked ?? {}} />
      {report}
    </>
  );
}

export function AssetsAndLiabilitiesTrendColdVisit({
  show,
  lines,
}: AssetsAndLiabilitiesTrendColdVisitProps): ReactNode {
  const [attempt, setAttempt] = useState(0);
  return (
    <ColdVisitAttempt
      key={attempt}
      show={show}
      lines={lines}
      retry={() => {
        setAttempt((current) => current + 1);
      }}
    />
  );
}
