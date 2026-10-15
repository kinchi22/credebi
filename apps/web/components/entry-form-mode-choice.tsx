'use client';

import { useTranslations } from 'next-intl';
import { entryFormModeSchema, type EntryFormMode, type Side } from '@repo/contracts';
import { useId, type ChangeEvent, type ReactNode } from 'react';
import { PANEL_FRAME } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import {
  CHOSEN_SEGMENT,
  LEGEND,
  SEGMENT,
  SEGMENT_RADIO,
  SETTINGS_ROW,
  UNCHOSEN_SEGMENT,
} from './control-classes';
import { useSavedChoice, type SettingChange } from './saved-choice';
import { SIDE_TONE } from './side-classes';
import { DANGER_TEXT } from './text-classes';

export type EntryFormModeChoiceProps = {
  readonly chosen: EntryFormMode;
  readonly action: (entryFormMode: string) => Promise<SettingChange>;
};

type Bar = { readonly side: Side; readonly width: number };

const BAR_HEIGHT = 4;
const BAR_PITCH = 9;
const DRAWING_WIDTH = 72;

const MODE_BARS: Readonly<Record<EntryFormMode, readonly Bar[]>> = {
  'two-line': [
    { side: 'debit', width: 56 },
    { side: 'credit', width: 56 },
  ],
  'multi-line': [
    { side: 'debit', width: 64 },
    { side: 'debit', width: 40 },
    { side: 'credit', width: 52 },
    { side: 'credit', width: 28 },
  ],
};

function ModeDrawing({ mode }: { readonly mode: EntryFormMode }): ReactNode {
  const bars = MODE_BARS[mode];
  const height = (bars.length - 1) * BAR_PITCH + BAR_HEIGHT;
  return (
    <svg aria-hidden="true" width={DRAWING_WIDTH} height={height} className="self-start">
      {bars.map((bar, index) => (
        <rect
          key={index}
          x={0}
          y={index * BAR_PITCH}
          width={bar.width}
          height={BAR_HEIGHT}
          rx={BAR_HEIGHT / 2}
          className={SIDE_TONE[bar.side].fill}
        />
      ))}
    </svg>
  );
}

export function EntryFormModeChoice({ chosen, action }: EntryFormModeChoiceProps): ReactNode {
  const t = useTranslations();
  const { selected, refused, pending, choose } = useSavedChoice(chosen, action);
  const id = useId();

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    choose(entryFormModeSchema.parse(event.currentTarget.value));
  };

  return (
    <div className="flex flex-col gap-2">
      <fieldset className={`${SETTINGS_ROW} border-t`}>
        <legend className={`float-left p-0 ${LEGEND}`}>
          {t('settingsPage.entryFormMode')}
        </legend>
        <div className={`grid auto-cols-fr grid-flow-col grid-rows-[auto_auto_auto] gap-y-2 self-stretch p-0.5 ${PANEL_FRAME} wide:max-w-2xl wide:flex-1 wide:self-auto`}>
          {entryFormModeSchema.options.map((mode) => (
            <label key={mode} className={`relative row-span-3 grid grid-rows-subgrid ${typeClasses['body-sm']}`}>
              <input
                type="radio"
                name={id}
                value={mode}
                checked={selected === mode}
                disabled={pending}
                onChange={change}
                aria-labelledby={`${id}-${mode}-name`}
                aria-describedby={`${id}-${mode}-description`}
                className={SEGMENT_RADIO}
              />
              <span
                className={`row-span-3 grid grid-rows-subgrid ${SEGMENT} ${selected === mode ? CHOSEN_SEGMENT : UNCHOSEN_SEGMENT}`}
              >
                <ModeDrawing mode={mode} />
                <span
                  id={`${id}-${mode}-name`}
                  className={selected === mode ? 'font-semibold' : undefined}
                >
                  {t(`settingsPage.entryFormModes.${mode}`)}
                </span>
                <span id={`${id}-${mode}-description`} className={typeClasses['body-dense']}>
                  {t(`settingsPage.entryFormModeDescriptions.${mode}`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {refused ? (
        <p role="alert" className={DANGER_TEXT}>
          {t('settingsPage.notSaved')}
        </p>
      ) : null}
    </div>
  );
}
