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
  const open = isHelpTipOpen(state);

  const on = (event: HelpTipEvent): void => {
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
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className="inline-flex shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') on('enter');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') on('leave');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          on('dismiss');
        }
      }}
    >
      <button
        type="button"
        aria-label={`${en.helpTip.about} ${message}`}
        aria-expanded={open}
        onClick={() => {
          on('toggle');
        }}
        className={`size-6 ${BARE_ICON_BUTTON}`}
      >
        <HelpIcon />
      </button>
      <span role="status">
        {open ? (
          <span className="absolute top-full left-0 z-10 block w-64 max-w-[calc(100vw-2rem)] pt-1">
            <span
              className={`block rounded-control border border-border bg-surface px-3 py-2 font-normal text-text ${typeClasses['body-dense']}`}
            >
              {children}
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );
}
