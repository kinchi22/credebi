import { type SearchQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { answerAssetsAndLiabilities } from '../server/assets-and-liabilities';
import { ASSETS_AND_LIABILITIES_PATH, pathWithQuery } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest } from '../server/signed-in-read-request';
import { AssetsAndLiabilitiesOutcome } from './assets-and-liabilities-tables';
import { type KeepCollapsed } from './statement-group';

export type AssetsAndLiabilitiesSectionProps = {
  readonly query: SearchQuery;
  readonly keep: KeepCollapsed;
};

export async function AssetsAndLiabilitiesSection({
  query,
  keep,
}: AssetsAndLiabilitiesSectionProps): Promise<ReactNode> {
  const path = pathWithQuery(ASSETS_AND_LIABILITIES_PATH, query);
  const answer = await withSectionFault('assets-and-liabilities.report', () =>
    answerAssetsAndLiabilities(
      (day) => readOfRequest(path, (caller) => caller.entries.assetsAndLiabilities(day)),
      query,
    ),
  );
  if (answer.outcome === 'unavailable') {
    throw new Error('The assets and liabilities could not be loaded.');
  }
  return <AssetsAndLiabilitiesOutcome answer={answer} keep={keep} />;
}
