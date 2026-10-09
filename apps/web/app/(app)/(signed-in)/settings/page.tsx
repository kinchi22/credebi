import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { AccountsSection } from '../../../../components/accounts-section';
import { EntryFormModeChoice } from '../../../../components/entry-form-mode-choice';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { SETTINGS_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';
import { addAccount, changeEntryFormMode, editAccount } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.settingsPage.title,
};

export default async function SettingsPage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  const [settings, chart] = await Promise.all([
    orSignIn(caller.settings.read(), SETTINGS_PATH),
    orSignIn(caller.accounts.chart(), SETTINGS_PATH),
  ]);

  return (
    <>
      <h2 className={typeClasses.h2}>{en.settingsPage.title}</h2>
      <EntryFormModeChoice chosen={settings.entryFormMode} action={changeEntryFormMode} />
      <AccountsSection chart={chart} addAction={addAccount} editAction={editAccount} />
    </>
  );
}
