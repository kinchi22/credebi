import { ASSETS_AND_LIABILITIES_FIELDS, type SearchQuery } from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesColdVisit } from '../../../../components/assets-and-liabilities-cold-visit';
import { AssetsAndLiabilitiesForm } from '../../../../components/assets-and-liabilities-form';
import { AssetsAndLiabilitiesSection } from '../../../../components/assets-and-liabilities-section';
import { AssetsAndLiabilitiesSkeleton } from '../../../../components/assets-and-liabilities-skeletons';
import { LoadingSection } from '../../../../components/loading-section';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { dayOfQuery } from '../../../../server/assets-and-liabilities';
import { createContext } from '../../../../server/context';
import {
  ASSETS_AND_LIABILITIES_PATH,
  pathWithQuery,
  signInPath,
} from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { keepCollapsed } from '../actions';
import { showDefaultDay } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('assetsAndLiabilitiesPage.title') };
}

type AssetsAndLiabilitiesPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function AssetsAndLiabilitiesPage({
  searchParams,
}: AssetsAndLiabilitiesPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const t = await getTranslations();
  const heading = <h1 className={PAGE_HEADING}>{t('assetsAndLiabilitiesPage.title')}</h1>;
  const path = pathWithQuery(ASSETS_AND_LIABILITIES_PATH, query);
  const caller = createCaller(await createContext());
  if (!(await caller.auth.signedIn())) {
    redirect(signInPath(path));
  }

  if (query[ASSETS_AND_LIABILITIES_FIELDS.date] === undefined) {
    return (
      <>
        {heading}
        <AssetsAndLiabilitiesColdVisit show={showDefaultDay} keep={keepCollapsed} />
      </>
    );
  }

  const day = dayOfQuery(query);

  return (
    <>
      {heading}
      <AssetsAndLiabilitiesForm key={day.date ?? ''} day={day} />
      <LoadingSection
        key={JSON.stringify(query)}
        name={t('assetsAndLiabilitiesPage.title')}
        skeleton={<AssetsAndLiabilitiesSkeleton />}
      >
        <AssetsAndLiabilitiesSection query={query} keep={keepCollapsed} />
      </LoadingSection>
    </>
  );
}
