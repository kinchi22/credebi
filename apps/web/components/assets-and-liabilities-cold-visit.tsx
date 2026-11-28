'use client';

import { type AssetsAndLiabilitiesQuery } from '@repo/contracts';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { type AssetsAndLiabilitiesAnswer } from '../server/assets-and-liabilities';
import { AssetsAndLiabilitiesForm } from './assets-and-liabilities-form';
import { AssetsAndLiabilitiesSkeleton } from './assets-and-liabilities-skeletons';
import { AssetsAndLiabilitiesOutcome } from './assets-and-liabilities-tables';
import { SectionFailure } from './section-error-boundary';
import { type KeepCollapsed } from './statement-group';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultDay = (day: AssetsAndLiabilitiesQuery) => Promise<AssetsAndLiabilitiesAnswer>;

export type AssetsAndLiabilitiesColdVisitProps = {
  readonly show: ShowDefaultDay;
  readonly keep: KeepCollapsed;
};

const onDay = (date: string): AssetsAndLiabilitiesQuery => ({ date });

type AttemptProps = AssetsAndLiabilitiesColdVisitProps & { readonly retry: () => void };

function ColdVisitAttempt({ show, keep, retry }: AttemptProps): ReactNode {
  const t = useTranslations();
  const { asked: day = {}, todayKey, answer } = useDefaultAnswer(onDay, show);

  let report: ReactNode;
  if (answer === undefined) {
    report = <AssetsAndLiabilitiesSkeleton />;
  } else if (answer === UNAVAILABLE || answer.outcome === 'unavailable') {
    report = <SectionFailure name={t('assetsAndLiabilitiesPage.title')} retry={retry} />;
  } else {
    report = <AssetsAndLiabilitiesOutcome answer={answer} keep={keep} />;
  }

  return (
    <>
      <AssetsAndLiabilitiesForm key={todayKey} day={day} />
      {report}
    </>
  );
}

export function AssetsAndLiabilitiesColdVisit({ show, keep }: AssetsAndLiabilitiesColdVisitProps): ReactNode {
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
