'use client';

import { type DomainErrorCode } from '@repo/contracts';
import { useState, useTransition } from 'react';

export type SettingChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type SavedChoice<Choice> = {
  readonly selected: Choice;
  readonly refused: boolean;
  readonly pending: boolean;
  readonly choose: (next: Choice) => void;
};

export function useSavedChoice<Choice>(
  chosen: Choice,
  save: (choice: Choice) => Promise<SettingChange>,
): SavedChoice<Choice> {
  const [selected, setSelected] = useState(chosen);
  const [refused, setRefused] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (next: Choice): void => {
    const previous = selected;
    setSelected(next);
    setRefused(false);
    startTransition(async () => {
      const outcome = await save(next).then(
        (result) => result.outcome,
        (): SettingChange['outcome'] => 'rejected',
      );
      if (outcome === 'rejected') {
        setSelected(previous);
        setRefused(true);
      }
    });
  };

  return { selected, refused, pending, choose };
}
