import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react';
import { useModalDialog, type ModalDialog } from './modal-dialog';

export type ChangeGuard = {
  readonly discard: ModalDialog;
  readonly requestClose: () => void;
  readonly discardChanges: () => void;
  readonly dialogProps: ModalDialog['dialogProps'] & {
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
    dialogProps: {
      ...dialog.dialogProps,
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
