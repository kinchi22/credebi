import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { WIDE_QUERY } from './wide';

export type ModalDialog = {
  readonly open: boolean;
  readonly show: (opener: HTMLElement | null) => boolean;
  readonly close: () => void;
  readonly dialogProps: {
    readonly ref: RefObject<HTMLDialogElement | null>;
    readonly onClose: () => void;
    readonly onClick: (event: MouseEvent<HTMLDialogElement>) => void;
  };
};

function useCloseWhenWide(dialog: RefObject<HTMLDialogElement | null>): void {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = (): void => {
      if (wide.matches) dialog.current?.close();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => {
      wide.removeEventListener('change', closeWhenWide);
    };
  }, [dialog]);
}

export function useModalDialog(): ModalDialog {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useCloseWhenWide(dialog);

  const close = (): void => {
    dialog.current?.close();
  };

  return {
    open,
    show: (from) => {
      const element = dialog.current;
      if (element === null || element.open) return false;
      opener.current = from;
      element.showModal();
      setOpen(true);
      return true;
    },
    close,
    dialogProps: {
      ref: dialog,
      onClose: () => {
        setOpen(false);
        opener.current?.focus();
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) close();
      },
    },
  };
}
