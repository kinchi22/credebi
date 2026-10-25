'use client';

import { type AssetsAndLiabilitiesQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesAnswer } from '../server/assets-and-liabilities';
import { AssetsAndLiabilitiesForm } from './assets-and-liabilities-form';
import {
  AssetsAndLiabilitiesOutcome,
  AssetsAndLiabilitiesPending,
} from './assets-and-liabilities-tables';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultDay = (asked: AssetsAndLiabilitiesQuery) => Promise<AssetsAndLiabilitiesAnswer>;

export type AssetsAndLiabilitiesColdVisitProps = {
  readonly show: ShowDefaultDay;
};

const onDay = (date: string): AssetsAndLiabilitiesQuery => ({ date });

export function AssetsAndLiabilitiesColdVisit({ show }: AssetsAndLiabilitiesColdVisitProps): ReactNode {
  const { asked, todayKey, answer } = useDefaultAnswer(onDay, show);
  const day = asked ?? {};

  return (
    <>
      <AssetsAndLiabilitiesForm key={todayKey} asked={day} />
      {answer === undefined ? (
        <AssetsAndLiabilitiesPending />
      ) : (
        <AssetsAndLiabilitiesOutcome
          answer={answer === UNAVAILABLE ? { outcome: UNAVAILABLE, asked: day } : answer}
        />
      )}
    </>
  );
}
