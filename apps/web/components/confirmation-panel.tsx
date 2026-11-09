'use client';

import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode, type TransitionStartFunction } from 'react';
import { BUTTON, CONFIRMATION_PANEL, DANGER_BUTTON } from './control-classes';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

export type ConfirmationPanelProps = {
  readonly titleId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly cancel: string;
  readonly confirm: string;
  readonly confirming: string;
  readonly unavailable: string;
  readonly act: () => Promise<string | undefined>;
  readonly onDone: () => void;
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
};

export function ConfirmationPanel({
  titleId,
  title,
  subtitle,
  children,
  cancel,
  confirm,
  confirming,
  unavailable,
  act,
  onDone,
  pending,
  startTransition,
}: ConfirmationPanelProps): ReactNode {
  const [refusal, setRefusal] = useState<string>();

  const run = (): void => {
    startTransition(async () => {
      const refused = await act().then(
        (answer) => answer,
        () => unavailable,
      );
      if (refused === undefined) {
        onDone();
        return;
      }
      setRefusal(refused);
    });
  };

  return (
    <div className={CONFIRMATION_PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className={typeClasses.h2}>
          {title}
        </h2>
        {subtitle === undefined ? null : <p className={MUTED_TEXT}>{subtitle}</p>}
      </div>
      <div className={`border-y border-border py-2 ${typeClasses['body-sm']}`}>{children}</div>
      {refusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {refusal}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus onClick={onDone} disabled={pending} className={BUTTON}>
          {cancel}
        </button>
        <button type="button" onClick={run} disabled={pending} className={DANGER_BUTTON}>
          {pending ? confirming : confirm}
        </button>
      </div>
    </div>
  );
}
