import { type SearchQuery } from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendForm } from '../../../../../components/assets-and-liabilities-trend-form';
import { AssetsAndLiabilitiesTrendOutcome } from '../../../../../components/assets-and-liabilities-trend-outcome';
import { PAGE_HEADING } from '../../../../../components/text-classes';
import { answerAssetsAndLiabilitiesTrend } from '../../../../../server/assets-and-liabilities-trend';
import { createContext } from '../../../../../server/context';
import {
  ASSETS_AND_LIABILITIES_TREND_PATH,
  pathWithQuery,
  signInPath,
} from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { orSignIn } from '../../../../../server/sign-in-redirect';

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
  const path = pathWithQuery(ASSETS_AND_LIABILITIES_TREND_PATH, query);
  const caller = createCaller(await createContext());
  if (!(await caller.auth.signedIn())) {
    redirect(signInPath(path));
  }

  const answer = await answerAssetsAndLiabilitiesTrend(
    (range) => orSignIn(caller.entries.assetsAndLiabilitiesTrend(range), path),
    query,
  );

  return (
    <>
      <h1 className={PAGE_HEADING}>{t('assetsAndLiabilitiesTrendPage.title')}</h1>
      <AssetsAndLiabilitiesTrendForm
        key={`${answer.range.from ?? ''} ${answer.range.to ?? ''}`}
        range={answer.range}
      />
      <AssetsAndLiabilitiesTrendOutcome answer={answer} />
    </>
  );
}
