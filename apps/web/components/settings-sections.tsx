import { headers } from 'next/headers';
import { cache, type ReactNode } from 'react';
import { createContext } from '../server/context';
import { authorizationServerAt, requestOrigin } from '../server/oauth';
import { SETTINGS_PATH } from '../server/return-path';
import { createCaller } from '../server/root-router';
import { withSectionFault } from '../server/section-fault-request';
import { orSignIn } from '../server/sign-in-redirect';
import { AccountsSection, type AccountsSectionProps } from './accounts-section';
import {
  ConnectionsSection,
  type ConnectionsSectionProps,
} from './connections-section';
import { EntryFormModeChoice, type EntryFormModeChoiceProps } from './entry-form-mode-choice';
import { LanguageChoice, type LanguageChoiceProps } from './language-choice';

const callerOfRequest = cache(async () => createCaller(await createContext()));

const settingsOfRequest = cache(async () =>
  orSignIn((await callerOfRequest()).settings.read(), SETTINGS_PATH),
);

export async function SettingsEntryFormModeSection({
  action,
}: Pick<EntryFormModeChoiceProps, 'action'>): Promise<ReactNode> {
  const settings = await withSectionFault('settings.entry-form-mode', settingsOfRequest);
  return <EntryFormModeChoice chosen={settings.entryFormMode} action={action} />;
}

export async function SettingsAccountsSection({
  actions,
}: Pick<AccountsSectionProps, 'actions'>): Promise<ReactNode> {
  const chart = await withSectionFault('settings.accounts', async () =>
    orSignIn((await callerOfRequest()).accounts.chart(), SETTINGS_PATH),
  );
  return <AccountsSection chart={chart} actions={actions} />;
}

export async function SettingsLanguageSection({
  action,
}: Pick<LanguageChoiceProps, 'action'>): Promise<ReactNode> {
  const settings = await withSectionFault('settings.language', settingsOfRequest);
  return <LanguageChoice chosen={settings.language} action={action} />;
}

export async function SettingsConnectionsSection({
  action,
}: Pick<ConnectionsSectionProps, 'action'>): Promise<ReactNode> {
  const connections = await withSectionFault('settings.connections', async () =>
    orSignIn((await callerOfRequest()).auth.connections(), SETTINGS_PATH),
  );
  const { mcpUrl } = authorizationServerAt(requestOrigin(await headers()));
  return <ConnectionsSection connections={connections} mcpUrl={mcpUrl} action={action} />;
}
