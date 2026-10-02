'use client';

import {
  entryFormModeSchema,
  type DomainErrorCode,
  type EntryFormMode,
  type Side,
} from '@repo/contracts';
import { useId, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { typeClasses } from '@repo/ui/type-classes';
import { en } from '../messages/en';
import { LEGEND } from './control-classes';
import { SIDE_TONE } from './side-classes';
import { DANGER_TEXT } from './text-classes';

export type EntryFormModeChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type EntryFormModeChoiceProps = {
  readonly chosen: EntryFormMode;
  readonly action: (entryFormMode: string) => Promise<EntryFormModeChange>;
};

type Status = 'idle' | EntryFormModeChange['outcome'];

type Bar = { readonly side: Side; readonly width: number };

const CHOSEN_SEGMENT = 'bg-accent/15 text-text';

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
  const [selected, setSelected] = useState(chosen);
  const [status, setStatus] = useState<Status>('idle');
  const [pending, startTransition] = useTransition();
  const id = useId();

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = entryFormModeSchema.parse(event.currentTarget.value);
    const previous = selected;
    setSelected(next);
    setStatus('idle');
    startTransition(async () => {
      const outcome = await action(next).then(
        (result) => result.outcome,
        (): Status => 'rejected',
      );
      if (outcome === 'rejected') {
        setSelected(previous);
      }
      setStatus(outcome);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="m-0 flex flex-col gap-3 border-0 border-y border-border px-0 py-4 wide:flex-row wide:items-center wide:justify-between">
        <legend className={`float-left p-0 ${LEGEND}`}>
          {en.settingsPage.entryFormMode}
        </legend>
        <div className="grid auto-cols-fr grid-flow-col grid-rows-[auto_auto_auto] gap-y-2 self-stretch rounded border border-border-control bg-surface p-0.5 wide:max-w-2xl wide:flex-1 wide:self-auto">
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
                className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-default"
              />
              <span
                className={`row-span-3 grid grid-rows-subgrid rounded px-3 py-2 ${selected === mode ? CHOSEN_SEGMENT : 'text-text-muted'} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50`}
              >
                <ModeDrawing mode={mode} />
                <span
                  id={`${id}-${mode}-name`}
                  className={selected === mode ? 'font-semibold' : undefined}
                >
                  {en.settingsPage.entryFormModes[mode]}
                </span>
                <span id={`${id}-${mode}-description`} className={typeClasses['body-dense']}>
                  {en.settingsPage.entryFormModeDescriptions[mode]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" className={`${typeClasses['body-sm']} text-positive`}>
        {status === 'saved' ? en.settingsPage.saved : null}
      </p>
      {status === 'rejected' ? (
        <p role="alert" className={DANGER_TEXT}>
          {en.settingsPage.notSaved}
        </p>
      ) : null}
    </div>
  );
}
