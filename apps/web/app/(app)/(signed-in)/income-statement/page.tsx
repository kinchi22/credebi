import { INCOME_STATEMENT_FIELDS, type SearchQuery } from '@repo/contracts';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { IncomeStatementForm } from '../../../../components/income-statement-form';
import { IncomeStatementOutcome } from '../../../../components/income-statement-tables';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { createContext } from '../../../../server/context';
import { answerIncomeStatement } from '../../../../server/income-statement';
import { INCOME_STATEMENT_PATH, pathWithQuery, signInPath } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';

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
        <IncomeStatementForm period={{}} />
      </>
    );
  }

  const answer = await answerIncomeStatement(
    (period) => orSignIn(caller.entries.incomeStatement(period), path),
    query,
  );

  return (
    <>
      {heading}
      <IncomeStatementForm period={answer.period} />
      <IncomeStatementOutcome answer={answer} />
    </>
  );
}
