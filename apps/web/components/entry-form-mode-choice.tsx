'use client';

import { entryFormModeSchema, type DomainErrorCode, type EntryFormMode } from '@repo/contracts';
import { useId, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { en } from '../messages/en';

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
      const result = await action(next);
      if (result.outcome === 'rejected') {
        setSelected(previous);
      }
      setStatus(result.outcome);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-2 rounded-lg border border-neutral-300 p-4">
        <legend className="px-1 text-sm font-semibold">{en.settingsPage.entryFormMode}</legend>
        {entryFormModeSchema.options.map((mode) => (
          <div key={mode} className="flex items-center gap-2 text-sm">
            <input
              id={`${id}-${mode}`}
              type="radio"
              name={id}
              value={mode}
              checked={selected === mode}
              disabled={pending}
              onChange={change}
            />
            <label htmlFor={`${id}-${mode}`}>{en.settingsPage.entryFormModes[mode]}</label>
          </div>
        ))}
      </fieldset>
      <p role="status" className="text-sm text-neutral-600">
        {status === 'saved' ? en.settingsPage.saved : null}
      </p>
      {status === 'rejected' ? (
        <p role="alert" className="text-sm text-red-700">
          {en.settingsPage.notSaved}
        </p>
      ) : null}
    </div>
  );
}
