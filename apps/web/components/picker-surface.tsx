'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { CloseButton } from './close-button';
import { POPOVER_FRAME } from './control-classes';
import { SheetBar } from './sheet';
import { useDismissOutside } from './use-dismiss-outside';
import { useModalDialog, type ModalDialog } from './use-modal-dialog';
import { useWide, WIDE_QUERY } from './use-wide';

export type PickerSurface = {
  readonly bindTrigger: (element: HTMLButtonElement | null) => void;
  readonly sheet: ModalDialog;
  readonly popoverStart: string | undefined;
  readonly sheetStart: string | undefined;
  readonly controls: string;
  readonly titleId: string;
  readonly expanded: boolean;
  readonly open: (opener: HTMLButtonElement, start: string | undefined) => void;
  readonly finish: () => void;
  readonly bindRoot: (element: HTMLDivElement | null) => void;
  readonly rootProps: {
    readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  };
};

function useClosedWhenNarrow(close: () => void): void {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenNarrow = (): void => {
      if (!wide.matches) close();
    };
    wide.addEventListener('change', closeWhenNarrow);
    return () => {
      wide.removeEventListener('change', closeWhenNarrow);
    };
  }, [close]);
}

export function usePickerSurface(): PickerSurface {
  const wide = useWide();
  const sheet = useModalDialog();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const bindTrigger = useCallback((element: HTMLButtonElement | null): void => {
    trigger.current = element;
  }, []);
  const [rootElement, bindRoot] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    root.current = rootElement;
  }, [rootElement]);
  const [popoverStart, setPopoverStart] = useState<string>();
  const [sheetStart, setSheetStart] = useState<string>();
  const controls = useId();
  const popoverOpen = popoverStart !== undefined;

  const closePopover = useCallback((): void => {
    setPopoverStart(undefined);
  }, []);

  useDismissOutside(popoverOpen, root, closePopover);
  useClosedWhenNarrow(closePopover);

  const open = (opener: HTMLButtonElement, start: string | undefined): void => {
    if (popoverOpen || start === undefined) {
      closePopover();
      return;
    }
    if (wide) {
      setPopoverStart(start);
    } else if (sheet.show(opener)) {
      setSheetStart(start);
    }
  };

  const finish = (): void => {
    if (popoverOpen) {
      closePopover();
      trigger.current?.focus();
    } else {
      sheet.close();
    }
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && popoverOpen) {
      event.preventDefault();
      closePopover();
      trigger.current?.focus();
    }
  };

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) {
      closePopover();
    }
  };

  return {
    bindTrigger,
    sheet,
    popoverStart,
    sheetStart,
    controls,
    titleId: `${controls}-title`,
    expanded: popoverOpen || sheet.open,
    open,
    finish,
    bindRoot,
    rootProps: { onBlur: closeWhenFocusLeaves, onKeyDown: closeOnEscape },
  };
}

export type PickerPanelProps = {
  readonly surface: PickerSurface;
  readonly label: string;
  readonly popoverLabel?: string;
  readonly closeLabel: string;
  readonly className: string;
  readonly children: (start: string) => ReactNode;
};

export function PickerPanel({
  surface,
  label,
  popoverLabel,
  closeLabel,
  className,
  children,
}: PickerPanelProps): ReactNode {
  const { popoverStart, sheetStart, sheet, controls, titleId } = surface;
  return (
    <>
      {popoverStart === undefined ? null : (
        <div className="absolute top-full left-0 z-10 pt-1.5">
          <div
            id={controls}
            role="dialog"
            aria-label={popoverLabel ?? label}
            className={`${className} ${POPOVER_FRAME}`}
          >
            {children(popoverStart)}
          </div>
        </div>
      )}
      <dialog
        {...sheet.dialogProps}
        id={popoverStart === undefined ? controls : undefined}
        aria-labelledby={titleId}
        onClick={sheet.closeOnScrim}
        className="mx-0 mt-auto mb-0 max-h-none w-full max-w-none overflow-hidden rounded-t-panel border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60"
      >
        {sheet.open && sheetStart !== undefined ? (
          <>
            <SheetBar titleId={titleId} title={label}>
              <CloseButton label={closeLabel} onClose={sheet.close} />
            </SheetBar>
            <div className="px-4 pt-3 pb-5">{children(sheetStart)}</div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
