'use client';

import { defaultTrendRange, type MonthRange } from '@repo/core/entries';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { type DefaultTrend } from '../server/assets-and-liabilities-trend';
import { type KeepShownLines } from './assets-and-liabilities-trend-chart';
import { AssetsAndLiabilitiesTrendForm } from './assets-and-liabilities-trend-form';
import {
  AssetsAndLiabilitiesTrendOutcome,
  AssetsAndLiabilitiesTrendSkeleton,
} from './assets-and-liabilities-trend-outcome';
import { RetryingColdVisit } from './retrying-cold-visit';
import { SectionFailure } from './section-error-boundary';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultTrendRange = (range: MonthRange) => Promise<DefaultTrend>;

export type AssetsAndLiabilitiesTrendColdVisitProps = {
  readonly show: ShowDefaultTrendRange;
  readonly keep: KeepShownLines;
};

type AttemptProps = AssetsAndLiabilitiesTrendColdVisitProps & { readonly retry: () => void };

function ColdVisitAttempt({ show, keep, retry }: AttemptProps): ReactNode {
  const t = useTranslations();
  const { asked, todayKey, answer } = useDefaultAnswer(defaultTrendRange, show);

  let report: ReactNode;
  if (answer === undefined) {
    report = <AssetsAndLiabilitiesTrendSkeleton />;
  } else if (answer === UNAVAILABLE || answer.answer.outcome === 'unavailable') {
    report = <SectionFailure name={t('assetsAndLiabilitiesTrendPage.title')} retry={retry} />;
  } else {
    report = (
      <AssetsAndLiabilitiesTrendOutcome
        answer={answer.answer}
        lines={{ shown: answer.shownSeriesIds, keep }}
      />
    );
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
  keep,
}: AssetsAndLiabilitiesTrendColdVisitProps): ReactNode {
  return (
    <RetryingColdVisit>
      {(retry) => <ColdVisitAttempt show={show} keep={keep} retry={retry} />}
    </RetryingColdVisit>
  );
}
