import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { scrimPress } from './modal-dialog';
import { WIDE_QUERY } from './use-wide';

export type ModalDialog = {
  readonly open: boolean;
  readonly show: (opener: HTMLElement | null) => boolean;
  readonly close: () => void;
  readonly scrimClicked: (event: MouseEvent<HTMLDialogElement>) => boolean;
  readonly closeOnScrim: (event: MouseEvent<HTMLDialogElement>) => void;
  readonly dialogProps: {
    readonly ref: RefObject<HTMLDialogElement | null>;
    readonly onClose: () => void;
    readonly onPointerDown: (event: PointerEvent<HTMLDialogElement>) => void;
    readonly onPointerUp: (event: PointerEvent<HTMLDialogElement>) => void;
  };
};

export type ModalDialogOptions = {
  readonly closesWhenWide: boolean;
};

const SHEET: ModalDialogOptions = { closesWhenWide: true };

function useCloseWhenWide(close: () => void, closesWhenWide: boolean): void {
  useEffect(() => {
    if (!closesWhenWide) {
      return undefined;
    }
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = (): void => {
      if (wide.matches) close();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => {
      wide.removeEventListener('change', closeWhenWide);
    };
  }, [close, closesWhenWide]);
}

export function useModalDialog({ closesWhenWide }: ModalDialogOptions = SHEET): ModalDialog {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [press] = useState(scrimPress);

  const close = useCallback((): void => {
    dialog.current?.close();
    setOpen(false);
    const from = opener.current;
    opener.current = null;
    from?.focus();
  }, []);

  useCloseWhenWide(close, closesWhenWide);

  const scrimClicked = (event: MouseEvent<HTMLDialogElement>): boolean =>
    press.clicked(event.target, event.currentTarget);

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
    scrimClicked,
    closeOnScrim: (event) => {
      if (scrimClicked(event)) close();
    },
    dialogProps: {
      ref: dialog,
      onClose: () => {
        if (dialog.current?.open !== true) close();
      },
      onPointerDown: (event) => {
        press.began(event.target);
      },
      onPointerUp: (event) => {
        press.ended(event.target);
      },
    },
  };
}
