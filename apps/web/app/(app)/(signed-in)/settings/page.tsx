import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { AccountsSection } from '../../../../components/accounts-section';
import { EntryFormModeChoice } from '../../../../components/entry-form-mode-choice';
import { LanguageChoice } from '../../../../components/language-choice';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { createContext } from '../../../../server/context';
import { SETTINGS_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';
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
} from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('settingsPage.title') };
}

export default async function SettingsPage(): Promise<ReactNode> {
  const t = await getTranslations();
  const caller = createCaller(await createContext());
  const [settings, chart] = await Promise.all([
    orSignIn(caller.settings.read(), SETTINGS_PATH),
    orSignIn(caller.accounts.chart(), SETTINGS_PATH),
  ]);

  return (
    <>
      <h1 className={PAGE_HEADING}>{t('settingsPage.title')}</h1>
      <EntryFormModeChoice chosen={settings.entryFormMode} action={changeEntryFormMode} />
      <AccountsSection
        chart={chart}
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
      <LanguageChoice chosen={settings.language} action={changeLanguage} />
    </>
  );
}
