import { headers } from 'next/headers';
import { cache, type ReactNode } from 'react';
import { authorizationServerAt, requestOrigin } from '../server/oauth';
import { SETTINGS_PATH } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest, type RequestCaller } from '../server/signed-in-read-request';
import { AccountsSection, type AccountsSectionProps } from './accounts-section';
import {
  ConnectionsSection,
  type ConnectionsSectionProps,
} from './connections-section';
import { EntryFormModeChoice, type EntryFormModeChoiceProps } from './entry-form-mode-choice';
import { LanguageChoice, type LanguageChoiceProps } from './language-choice';

const readSettings = <T,>(read: (caller: RequestCaller) => Promise<T>): Promise<T> =>
  readOfRequest(SETTINGS_PATH, read);

const settingsOfRequest = cache(() => readSettings((caller) => caller.settings.read()));

export async function SettingsEntryFormModeSection({
  action,
}: Pick<EntryFormModeChoiceProps, 'action'>): Promise<ReactNode> {
  const settings = await withSectionFault('settings.entry-form-mode', settingsOfRequest);
  return <EntryFormModeChoice chosen={settings.entryFormMode} action={action} />;
}

export async function SettingsAccountsSection({
  actions,
}: Pick<AccountsSectionProps, 'actions'>): Promise<ReactNode> {
  const chart = await withSectionFault('settings.accounts', () =>
    readSettings((caller) => caller.accounts.chart()),
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
  const connections = await withSectionFault('settings.connections', () =>
    readSettings((caller) => caller.auth.connections()),
  );
  const { mcpUrl } = authorizationServerAt(requestOrigin(await headers()));
  return <ConnectionsSection connections={connections} mcpUrl={mcpUrl} action={action} />;
}
