import { type Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { AccountsSection } from '../../../../components/accounts-section';
import { ConnectionsSection } from '../../../../components/connections-section';
import { EntryFormModeChoice } from '../../../../components/entry-form-mode-choice';
import { LanguageChoice } from '../../../../components/language-choice';
import { PAGE_HEADING } from '../../../../components/text-classes';
import { createContext } from '../../../../server/context';
import { authorizationServerAt, requestOrigin } from '../../../../server/oauth';
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
  revokeConnection,
} from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('settingsPage.title') };
}

export default async function SettingsPage(): Promise<ReactNode> {
  const t = await getTranslations();
  const caller = createCaller(await createContext());
  const [settings, chart, connections] = await Promise.all([
    orSignIn(caller.settings.read(), SETTINGS_PATH),
    orSignIn(caller.accounts.chart(), SETTINGS_PATH),
    orSignIn(caller.auth.connections(), SETTINGS_PATH),
  ]);
  const { mcpUrl } = authorizationServerAt(requestOrigin(await headers()));

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
      <ConnectionsSection connections={connections} mcpUrl={mcpUrl} action={revokeConnection} />
    </>
  );
}
