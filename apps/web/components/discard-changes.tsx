'use client';

import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  BUTTON,
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  DANGER_BUTTON,
} from './control-classes';
import { type ModalDialog } from './modal-dialog';

export type DiscardChangesProps = {
  readonly dialog: ModalDialog;
  readonly body: string;
  readonly onDiscard: () => void;
};

export function DiscardChanges({ dialog, body, onDiscard }: DiscardChangesProps): ReactNode {
  const titleId = useId();

  return (
    <dialog
      {...dialog.dialogProps}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dialog.close();
        }
      }}
      aria-labelledby={titleId}
      onClick={dialog.closeOnScrim}
      className={`${CONFIRMATION_DIALOG} outline-none`}
    >
      {dialog.open ? (
        <div className={CONFIRMATION_PANEL}>
          <h2 id={titleId} className={typeClasses.h2}>
            {en.discardChanges.title}
          </h2>
          <p className={`border-y border-border py-2 ${typeClasses['body-sm']}`}>
            {body}
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" autoFocus onClick={dialog.close} className={BUTTON}>
              {en.discardChanges.keep}
            </button>
            <button type="button" onClick={onDiscard} className={DANGER_BUTTON}>
              {en.discardChanges.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
