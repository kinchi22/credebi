import { type SearchQuery } from '@repo/contracts';
import { PANEL_FRAME } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { BUTTON, PRIMARY_BUTTON } from '../../../../../components/control-classes';
import { DANGER_TEXT, MUTED_TEXT, PAGE_HEADING } from '../../../../../components/text-classes';
import { createContext } from '../../../../../server/context';
import { AUTHORIZE_PATH, requestOrigin } from '../../../../../server/oauth';
import { queryOf, signInPath } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { approve, deny } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('consentPage.title') };
}

type AuthorizePageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function AuthorizePage({ searchParams }: AuthorizePageProps): Promise<ReactNode> {
  const query = queryOf(await searchParams);
  const path = `${AUTHORIZE_PATH}${query}`;
  const t = await getTranslations();
  const caller = createCaller(await createContext());
  if (!(await caller.auth.signedIn())) {
    redirect(signInPath(path));
  }
  const outcome = await caller.auth.beginAuthorization({
    query,
    origin: requestOrigin(await headers()),
  });
  if (outcome.outcome === 'redirect') {
    redirect(outcome.location);
  }

  return (
    <>
      <h1 className={PAGE_HEADING}>{t('consentPage.title')}</h1>
      {outcome.outcome === 'untrusted' ? (
        <p role="alert" className={DANGER_TEXT}>
          {t('consentPage.untrusted')}
        </p>
      ) : (
        <section className={`flex max-w-xl flex-col gap-5 p-4 wide:p-6 ${PANEL_FRAME}`}>
          <div className="flex flex-col gap-1">
            <p className={`${typeClasses.h2} break-words text-text`}>{outcome.clientName}</p>
            <p className={MUTED_TEXT}>{t('consentPage.statedName')}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className={MUTED_TEXT}>{t('consentPage.returnsTo')}</p>
            <p className={`${typeClasses.title} break-all font-mono text-text`}>
              {outcome.redirectHost}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className={MUTED_TEXT}>{t('consentPage.asks')}</p>
            <ul className={`list-disc pl-5 ${typeClasses.body} text-text`}>
              {outcome.scopes.map((scope) => (
                <li key={scope}>{t(`consentPage.scopes.${scope}`)}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <form action={approve.bind(null, query)}>
              <button type="submit" className={PRIMARY_BUTTON}>
                {t('consentPage.approve')}
              </button>
            </form>
            <form action={deny.bind(null, query)}>
              <button type="submit" className={BUTTON}>
                {t('consentPage.deny')}
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
