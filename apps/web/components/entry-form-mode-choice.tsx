'use client';

import { entryFormModeSchema, type DomainErrorCode, type EntryFormMode } from '@repo/contracts';
import { useId, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { typeClasses } from '@repo/ui/type-classes';
import { en } from '../messages/en';
import { LEGEND } from './control-classes';
import { DANGER_TEXT } from './text-classes';

export type EntryFormModeChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type EntryFormModeChoiceProps = {
  readonly chosen: EntryFormMode;
  readonly action: (entryFormMode: string) => Promise<EntryFormModeChange>;
};

type Status = 'idle' | EntryFormModeChange['outcome'];

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
        <div className="flex self-start rounded border border-border-control bg-surface p-0.5 wide:self-auto">
          {entryFormModeSchema.options.map((mode) => (
            <label key={mode} className={`relative flex ${typeClasses['body-sm']}`}>
              <input
                type="radio"
                name={id}
                value={mode}
                checked={selected === mode}
                disabled={pending}
                onChange={change}
                className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-default"
              />
              <span className="rounded px-3 py-1 text-text-muted peer-checked:bg-accent/15 peer-checked:font-semibold peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50">
                {en.settingsPage.entryFormModes[mode]}
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
