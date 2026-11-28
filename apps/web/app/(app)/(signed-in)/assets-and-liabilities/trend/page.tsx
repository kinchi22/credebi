import {
  ASSETS_AND_LIABILITIES_TREND_FIELDS,
  type SearchQuery,
} from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendColdVisit } from '../../../../../components/assets-and-liabilities-trend-cold-visit';
import { AssetsAndLiabilitiesTrendForm } from '../../../../../components/assets-and-liabilities-trend-form';
import { AssetsAndLiabilitiesTrendSkeleton } from '../../../../../components/assets-and-liabilities-trend-outcome';
import { AssetsAndLiabilitiesTrendSection } from '../../../../../components/assets-and-liabilities-trend-section';
import { LoadingSection } from '../../../../../components/loading-section';
import { PAGE_HEADING } from '../../../../../components/text-classes';
import { rangeOfQuery } from '../../../../../server/assets-and-liabilities-trend';
import { createContext } from '../../../../../server/context';
import {
  ASSETS_AND_LIABILITIES_TREND_PATH,
  pathWithQuery,
  signInPath,
} from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { keepShownTrendLines, showDefaultTrendRange } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('assetsAndLiabilitiesTrendPage.title') };
}

type AssetsAndLiabilitiesTrendPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function AssetsAndLiabilitiesTrendPage({
  searchParams,
}: AssetsAndLiabilitiesTrendPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const t = await getTranslations();
  const heading = <h1 className={PAGE_HEADING}>{t('assetsAndLiabilitiesTrendPage.title')}</h1>;
  const path = pathWithQuery(ASSETS_AND_LIABILITIES_TREND_PATH, query);
  const caller = createCaller(await createContext());
  if (!(await caller.auth.signedIn())) {
    redirect(signInPath(path));
  }
  if (
    query[ASSETS_AND_LIABILITIES_TREND_FIELDS.from] === undefined &&
    query[ASSETS_AND_LIABILITIES_TREND_FIELDS.to] === undefined
  ) {
    return (
      <>
        {heading}
        <AssetsAndLiabilitiesTrendColdVisit show={showDefaultTrendRange} keep={keepShownTrendLines} />
      </>
    );
  }

  const range = rangeOfQuery(query);

  return (
    <>
      {heading}
      <AssetsAndLiabilitiesTrendForm key={`${range.from ?? ''} ${range.to ?? ''}`} range={range} />
      <LoadingSection
        key={JSON.stringify(query)}
        name={t('assetsAndLiabilitiesTrendPage.title')}
        skeleton={<AssetsAndLiabilitiesTrendSkeleton />}
      >
        <AssetsAndLiabilitiesTrendSection query={query} keep={keepShownTrendLines} />
      </LoadingSection>
    </>
  );
}
