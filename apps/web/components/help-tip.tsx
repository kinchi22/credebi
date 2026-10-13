'use client';

import { HelpIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { BARE_ICON_BUTTON } from './control-classes';
import { helpTipAfter, isHelpTipOpen, type HelpTipEvent, type HelpTipState } from './help-tip-state';

export const HELP_TIP_ROW = 'relative flex min-w-0 items-center gap-1';

type HelpTipProps = {
  readonly message: string;
  readonly children: ReactNode;
};

export function HelpTip({ message, children }: HelpTipProps): ReactNode {
  const [state, setState] = useState<HelpTipState>('closed');
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const open = isHelpTipOpen(state);

  const apply = (event: HelpTipEvent): void => {
    setState((current) => helpTipAfter(current, event));
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const dismissOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && root.current?.contains(event.target) !== true) {
        setState('closed');
      }
    };
    const dismissOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const focused = document.activeElement;
      setState('closed');
      if (focused !== button.current && root.current?.contains(focused) === true) {
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    window.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      window.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className="inline-flex shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') apply('enter');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') apply('leave');
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={`${en.helpTip.about} ${message}`}
        aria-expanded={open}
        onClick={() => {
          apply('toggle');
        }}
        className={`size-6 ${BARE_ICON_BUTTON}`}
      >
        <HelpIcon />
      </button>
      <span role="status">
        {open ? (
          <span className="absolute top-full left-0 z-10 block w-64 max-w-[calc(100vw-2rem)] pt-1">
            <span
              className={`block rounded-control border border-border bg-surface px-3 py-2 shadow-lift font-normal text-text ${typeClasses['body-dense']}`}
            >
              {children}
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );
}
