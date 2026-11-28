import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { LoadingSection } from '../../../../components/loading-section';
import {
  SettingsAccountsSection,
  SettingsConnectionsSection,
  SettingsEntryFormModeSection,
  SettingsLanguageSection,
} from '../../../../components/settings-sections';
import {
  AccountsSkeleton,
  ConnectionsSkeleton,
  EntryFormModeSkeleton,
  LanguageSkeleton,
} from '../../../../components/settings-skeletons';
import { PAGE_HEADING } from '../../../../components/text-classes';
import {
  addAccount,
  addAccountGroup,
  changeEntryFormMode,
  changeLanguage,
  deleteAccount,
  deleteAccountGroup,
  editAccount,
  editAccountGroup,
  moveChartNode,
  revokeConnection,
} from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('settingsPage.title') };
}

export default async function SettingsPage(): Promise<ReactNode> {
  const t = await getTranslations();

  return (
    <>
      <h1 className={PAGE_HEADING}>{t('settingsPage.title')}</h1>
      <LoadingSection name={t('settingsPage.entryFormMode')} skeleton={<EntryFormModeSkeleton />}>
        <SettingsEntryFormModeSection action={changeEntryFormMode} />
      </LoadingSection>
      <LoadingSection name={t('accountsSection.title')} skeleton={<AccountsSkeleton />}>
        <SettingsAccountsSection
          actions={{
            addAccount,
            editAccount,
            addAccountGroup,
            editAccountGroup,
            deleteAccount,
            deleteAccountGroup,
            moveChartNode,
          }}
        />
      </LoadingSection>
      <LoadingSection name={t('language.label')} skeleton={<LanguageSkeleton />}>
        <SettingsLanguageSection action={changeLanguage} />
      </LoadingSection>
      <LoadingSection name={t('connectionsSection.title')} skeleton={<ConnectionsSkeleton />}>
        <SettingsConnectionsSection action={revokeConnection} />
      </LoadingSection>
    </>
  );
}
