'use server';

import { ASSETS_AND_LIABILITIES_TREND_CHART } from '@repo/contracts';
import {
  answerDefaultTrendRange,
  type AssetsAndLiabilitiesTrendAnswer,
} from '../../../../../server/assets-and-liabilities-trend';
import { keepChartView } from '../../../../../server/chart-view';
import { createContext } from '../../../../../server/context';
import { ASSETS_AND_LIABILITIES_TREND_PATH } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { withSectionFault } from '../../../../../server/section-fault-request';
import { orSignIn } from '../../../../../server/sign-in-redirect';

export async function showDefaultTrendRange(range: unknown): Promise<AssetsAndLiabilitiesTrendAnswer> {
  const caller = createCaller(await createContext());
  return withSectionFault('assets-and-liabilities-trend.chart', () =>
    answerDefaultTrendRange(
      (asked) => orSignIn(caller.entries.assetsAndLiabilitiesTrend(asked), ASSETS_AND_LIABILITIES_TREND_PATH),
      range,
    ),
  );
}

export async function keepShownTrendLines(shownSeriesIds: unknown): Promise<void> {
  const context = await createContext();
  const caller = createCaller(context);
  await keepChartView(
    (input) => caller.charts.changeView(input),
    context.container.logger,
    ASSETS_AND_LIABILITIES_TREND_CHART,
    shownSeriesIds,
  );
}
