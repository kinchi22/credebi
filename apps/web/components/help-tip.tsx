'use client';

import { useTranslations } from 'next-intl';
import { HelpIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BARE_ICON_BUTTON } from './control-classes';
import { useDismissOutside } from './dismiss-outside';
import {
  helpTipAfter,
  helpTipMaxWidth,
  helpTipShift,
  isHelpTipOpen,
  type HelpTipEvent,
  type HelpTipState,
} from './help-tip-state';

const HELP_TIP_ROW = 'relative flex min-w-0 items-center gap-1';

type HelpTipProps = {
  readonly message: string;
  readonly children: ReactNode;
};

export function HelpTip({ message, children }: HelpTipProps): ReactNode {
  const t = useTranslations();
  const [state, setState] = useState<HelpTipState>('closed');
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const open = isHelpTipOpen(state);

  useLayoutEffect(() => {
    const shown = panel.current;
    if (!open || shown === null) {
      return undefined;
    }
    const keepOnScreen = (): void => {
      const viewportWidth = document.documentElement.clientWidth;
      shown.style.maxWidth = `${String(helpTipMaxWidth(viewportWidth))}px`;
      shown.style.translate = '';
      const { left, width } = shown.getBoundingClientRect();
      const shift = helpTipShift({ left, width }, viewportWidth);
      shown.style.translate = shift === 0 ? '' : `${String(shift)}px`;
    };
    keepOnScreen();
    window.addEventListener('resize', keepOnScreen);
    return () => {
      window.removeEventListener('resize', keepOnScreen);
    };
  }, [open]);

  const apply = (event: HelpTipEvent): void => {
    setState((current) => helpTipAfter(current, event));
  };

  const close = useCallback((): void => {
    setState('closed');
  }, []);
  useDismissOutside(open, root, close);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
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
    window.addEventListener('keydown', dismissOnEscape, true);
    return () => {
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
        aria-label={t('helpTip.about', { subject: message })}
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
          <span
            ref={panel}
            className="absolute top-full left-0 z-10 block w-64 pt-1"
          >
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

type WarningWithHelpTipProps = {
  readonly message: string;
  readonly children: ReactNode;
};

export function WarningWithHelpTip({ message, children }: WarningWithHelpTipProps): ReactNode {
  return (
    <div className={`${HELP_TIP_ROW} text-warning ${typeClasses['body-dense']}`}>
      <span>{message}</span>
      <HelpTip message={message}>{children}</HelpTip>
    </div>
  );
}
