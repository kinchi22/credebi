'use client';

import { typeClasses } from '@repo/ui/type-classes';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { en } from '../messages/en';
import {
  BUTTON,
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  DANGER_BUTTON,
} from './control-classes';
import { useModalDialog, type ModalDialog } from './modal-dialog';

export type DiscardChangesProps = {
  readonly dialog: ModalDialog;
  readonly body: string;
  readonly onDiscard: () => void;
};

export type ChangeGuard = {
  readonly discard: ModalDialog;
  readonly requestClose: () => void;
  readonly discardChanges: () => void;
  readonly dialogHandlers: {
    readonly onKeyDown: (event: KeyboardEvent<HTMLDialogElement>) => void;
    readonly onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
    readonly onClick: (event: MouseEvent<HTMLDialogElement>) => void;
  };
};

const fieldsIn = (dialog: HTMLDialogElement | null): string => {
  const form = dialog?.querySelector('form');
  return form ? JSON.stringify([...new FormData(form)]) : '';
};

export function useChangeGuard(dialog: ModalDialog, locked = false): ChangeGuard {
  const discard = useModalDialog({ closesWhenWide: false });
  const opened = useRef('');
  const element = dialog.dialogProps.ref;

  useEffect(() => {
    if (dialog.open) {
      opened.current = fieldsIn(element.current);
    }
  }, [dialog.open, element]);

  const requestClose = (): void => {
    if (locked) {
      return;
    }
    const edit = element.current;
    if (fieldsIn(edit) === opened.current) {
      dialog.close();
      return;
    }
    const focused = document.activeElement;
    discard.show(focused instanceof HTMLElement && edit?.contains(focused) ? focused : edit);
  };

  return {
    discard,
    requestClose,
    discardChanges: () => {
      discard.close();
      dialog.close();
    },
    dialogHandlers: {
      onKeyDown: (event) => {
        const target = event.target;
        if (
          event.key === 'Escape' &&
          target instanceof Element &&
          target.closest('dialog') === event.currentTarget
        ) {
          event.preventDefault();
          requestClose();
        }
      },
      onCancel: (event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          requestClose();
        }
      },
      onClick: (event) => {
        if (dialog.scrimClicked(event)) {
          requestClose();
        }
      },
    },
  };
}

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
