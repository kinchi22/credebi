import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { EntryFormModeChoice } from '../../../../components/entry-form-mode-choice';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { SETTINGS_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';
import { changeEntryFormMode } from './actions';
import {
  PrototypeAccountSettings,
  type PrototypeVariant,
} from '../../../../components/prototype-account-settings';

const VARIANTS: readonly { key: PrototypeVariant; name: string }[] = [
  { key: 'D', name: 'A + B band layout, icons, drag' },
  { key: 'A', name: 'Settings rows + dialog' },
  { key: 'B', name: 'Tree + detail pane' },
  { key: 'C', name: 'Outline table, inline edit' },
];
import { PrototypeSwitcher } from '../../../../components/prototype-switcher';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.settingsPage.title,
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}): Promise<ReactNode> {
  const asked = (await searchParams).variant ?? 'D';
  const variant: PrototypeVariant = VARIANTS.find((each) => each.key === asked)?.key ?? 'D';
  const caller = createCaller(await createContext());
  const settings = await orSignIn(caller.settings.read(), SETTINGS_PATH);

  return (
    <>
      <h2 className={typeClasses.h2}>{en.settingsPage.title}</h2>
      <EntryFormModeChoice chosen={settings.entryFormMode} action={changeEntryFormMode} />
      <PrototypeAccountSettings variant={variant} />
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
      />
    </>
  );
}
