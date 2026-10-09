'use client';

import { type ReactNode } from 'react';
import { CONFIRMATION_DIALOG } from './control-classes';
import { type ModalDialog } from './modal-dialog';

export type PendingDialogProps = {
  readonly dialog: ModalDialog;
  readonly titleId: string;
  readonly pending: boolean;
  readonly children: ReactNode;
};

export function PendingDialog({ dialog, titleId, pending, children }: PendingDialogProps): ReactNode {
  return (
    <dialog
      {...dialog.dialogProps}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (pending) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        if (!pending) {
          dialog.closeOnScrim(event);
        }
      }}
      className={CONFIRMATION_DIALOG}
    >
      {dialog.open ? children : null}
    </dialog>
  );
}
