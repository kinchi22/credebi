import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { EntriesFormSection, EntriesListSection } from '../../../../components/entries-sections';
import { EntriesFormSkeleton, EntriesListSkeleton } from '../../../../components/entries-skeletons';
import { LoadingSection } from '../../../../components/loading-section';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { deleteEntry, editEntry, postEntry } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('entriesPage.title') };
}

export default async function EntriesPage(): Promise<ReactNode> {
  const t = await getTranslations();

  return (
    <>
      <h1 className={PAGE_HEADING}>{t('entriesPage.title')}</h1>
      <LoadingSection name={t('entryForm.title')} skeleton={<EntriesFormSkeleton />}>
        <EntriesFormSection action={postEntry} />
      </LoadingSection>
      <LoadingSection name={t('entryList.title')} skeleton={<EntriesListSkeleton />}>
        <EntriesListSection controls={{ editEntry, deleteEntry }} />
      </LoadingSection>
    </>
  );
}
