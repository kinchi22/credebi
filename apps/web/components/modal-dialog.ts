import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { WIDE_QUERY } from './wide';

export type ModalDialog = {
  readonly open: boolean;
  readonly show: (opener: HTMLElement | null) => boolean;
  readonly close: () => void;
  readonly closeOnScrim: (event: MouseEvent<HTMLDialogElement>) => void;
  readonly dialogProps: {
    readonly ref: RefObject<HTMLDialogElement | null>;
    readonly onClose: () => void;
  };
};

function useCloseWhenWide(close: () => void): void {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = (): void => {
      if (wide.matches) close();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => {
      wide.removeEventListener('change', closeWhenWide);
    };
  }, [close]);
}

export function useModalDialog(): ModalDialog {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback((): void => {
    dialog.current?.close();
    setOpen(false);
    const from = opener.current;
    opener.current = null;
    from?.focus();
  }, []);

  useCloseWhenWide(close);

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
    closeOnScrim: (event) => {
      if (event.target === event.currentTarget) close();
    },
    dialogProps: { ref: dialog, onClose: close },
  };
}
