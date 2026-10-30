'use client';

import { defaultTrendRange, type MonthRange } from '@repo/core/entries';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesTrendAnswer } from '../server/assets-and-liabilities-trend';
import { AssetsAndLiabilitiesTrendForm } from './assets-and-liabilities-trend-form';
import {
  AssetsAndLiabilitiesTrendOutcome,
  AssetsAndLiabilitiesTrendPending,
} from './assets-and-liabilities-trend-outcome';
import { UNAVAILABLE, useDefaultAnswer } from './use-default-answer';

export type ShowDefaultTrendRange = (range: MonthRange) => Promise<AssetsAndLiabilitiesTrendAnswer>;

export type AssetsAndLiabilitiesTrendColdVisitProps = {
  readonly show: ShowDefaultTrendRange;
};

export function AssetsAndLiabilitiesTrendColdVisit({ show }: AssetsAndLiabilitiesTrendColdVisitProps): ReactNode {
  const { asked, todayKey, answer } = useDefaultAnswer(defaultTrendRange, show);
  const range = asked ?? {};

  return (
    <>
      <AssetsAndLiabilitiesTrendForm key={todayKey} range={range} />
      {answer === undefined ? (
        <AssetsAndLiabilitiesTrendPending />
      ) : (
        <AssetsAndLiabilitiesTrendOutcome
          answer={answer === UNAVAILABLE ? { outcome: UNAVAILABLE, range } : answer}
        />
      )}
    </>
  );
}
