import { ASSETS_AND_LIABILITIES_TREND_CHART, type SearchQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { answerAssetsAndLiabilitiesTrend } from '../server/assets-and-liabilities-trend';
import { ASSETS_AND_LIABILITIES_TREND_PATH, pathWithQuery } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest } from '../server/signed-in-read-request';
import { type KeepShownLines } from './assets-and-liabilities-trend-chart';
import { AssetsAndLiabilitiesTrendOutcome } from './assets-and-liabilities-trend-outcome';

export type AssetsAndLiabilitiesTrendSectionProps = {
  readonly query: SearchQuery;
  readonly keep: KeepShownLines;
};

export async function AssetsAndLiabilitiesTrendSection({
  query,
  keep,
}: AssetsAndLiabilitiesTrendSectionProps): Promise<ReactNode> {
  const path = pathWithQuery(ASSETS_AND_LIABILITIES_TREND_PATH, query);
  const [answer, { shownSeriesIds }] = await withSectionFault('assets-and-liabilities-trend.chart', () =>
    Promise.all([
      answerAssetsAndLiabilitiesTrend(
        (range) => readOfRequest(path, (caller) => caller.entries.assetsAndLiabilitiesTrend(range)),
        query,
      ),
      readOfRequest(path, (caller) => caller.charts.view({ chartId: ASSETS_AND_LIABILITIES_TREND_CHART })),
    ]),
  );
  if (answer.outcome === 'unavailable') {
    throw new Error('The assets and liabilities trend could not be loaded.');
  }
  return <AssetsAndLiabilitiesTrendOutcome answer={answer} lines={{ shown: shownSeriesIds, keep }} />;
}
