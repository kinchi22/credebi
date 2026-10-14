'use client';

import { languageSchema, type Language } from '@repo/contracts';
import { PANEL_FRAME } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useTranslations } from 'next-intl';
import { useId, type ChangeEvent, type ReactNode } from 'react';
import {
  CHOSEN_SEGMENT,
  LEGEND,
  SEGMENT,
  SEGMENT_RADIO,
  SETTINGS_ROW,
  UNCHOSEN_SEGMENT,
} from './control-classes';
import { useSavedChoice, type SettingChange } from './saved-choice';
import { DANGER_TEXT } from './text-classes';

export type LanguageChoiceProps = {
  readonly chosen: Language;
  readonly action: (language: string) => Promise<SettingChange>;
};

export function LanguageChoice({ chosen, action }: LanguageChoiceProps): ReactNode {
  const t = useTranslations();
  const { selected, refused, pending, choose } = useSavedChoice(chosen, action);
  const id = useId();

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    choose(languageSchema.parse(event.currentTarget.value));
  };

  return (
    <div className="flex flex-col gap-2">
      <fieldset className={SETTINGS_ROW}>
        <legend className={`float-left p-0 ${LEGEND}`}>{t('language.label')}</legend>
        <div
          className={`grid auto-cols-fr grid-flow-col self-stretch p-0.5 ${PANEL_FRAME} wide:max-w-2xl wide:flex-1 wide:self-auto`}
        >
          {languageSchema.options.map((language) => (
            <label key={language} lang={language} className={`relative flex ${typeClasses['body-sm']}`}>
              <input
                type="radio"
                name={id}
                value={language}
                checked={selected === language}
                disabled={pending}
                onChange={change}
                className={SEGMENT_RADIO}
              />
              <span
                className={`flex-1 text-center ${SEGMENT} ${selected === language ? `font-semibold ${CHOSEN_SEGMENT}` : UNCHOSEN_SEGMENT}`}
              >
                {t(`language.names.${language}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {refused ? (
        <p role="alert" className={DANGER_TEXT}>
          {t('settingsPage.languageNotSaved')}
        </p>
      ) : null}
    </div>
  );
}
