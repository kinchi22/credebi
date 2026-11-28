import { INCOME_STATEMENT_FIELDS, type SearchQuery } from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { IncomeStatementColdVisit } from '../../../../components/income-statement-cold-visit';
import { IncomeStatementForm } from '../../../../components/income-statement-form';
import { IncomeStatementSection } from '../../../../components/income-statement-section';
import { IncomeStatementSkeleton } from '../../../../components/income-statement-skeletons';
import { LoadingSection } from '../../../../components/loading-section';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { createContext } from '../../../../server/context';
import { periodOfQuery } from '../../../../server/income-statement';
import { INCOME_STATEMENT_PATH, pathWithQuery, signInPath } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { keepCollapsed } from '../actions';
import { showDefaultRange } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('incomeStatementPage.title') };
}

type IncomeStatementPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function IncomeStatementPage({
  searchParams,
}: IncomeStatementPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const t = await getTranslations();
  const heading = <h1 className={PAGE_HEADING}>{t('incomeStatementPage.title')}</h1>;
  const path = pathWithQuery(INCOME_STATEMENT_PATH, query);
  const caller = createCaller(await createContext());
  if (!(await caller.auth.signedIn())) {
    redirect(signInPath(path));
  }

  if (
    query[INCOME_STATEMENT_FIELDS.from] === undefined &&
    query[INCOME_STATEMENT_FIELDS.to] === undefined
  ) {
    return (
      <>
        {heading}
        <IncomeStatementColdVisit show={showDefaultRange} keep={keepCollapsed} />
      </>
    );
  }

  return (
    <>
      {heading}
      <IncomeStatementForm period={periodOfQuery(query)} />
      <LoadingSection
        key={JSON.stringify(query)}
        name={t('incomeStatementPage.title')}
        skeleton={<IncomeStatementSkeleton />}
      >
        <IncomeStatementSection query={query} keep={keepCollapsed} />
      </LoadingSection>
    </>
  );
}
