'use client';

import { typeClasses } from '@repo/ui/type-classes';
import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { ACROSS_STEPS } from './roving-focus';
import { slideFrom, swipeTarget, type SwipePoint } from './sheet-swipe';

export type SheetTabsProps<Tab extends string> = {
  readonly tabs: readonly Tab[];
  readonly shown: Tab;
  readonly onShow: (tab: Tab) => void;
  readonly tabId: (tab: Tab) => string;
  readonly panelId: (tab: Tab) => string;
  readonly label: (tab: Tab) => string;
} & TabsLookProps<Tab>;

export type TabsLook = {
  readonly strip: string;
  readonly idle: string;
  readonly shown: string;
};

type TabsLookProps<Tab extends string> =
  | { readonly shownTone?: (tab: Tab) => string; readonly look?: undefined }
  | { readonly look: TabsLook; readonly shownTone?: undefined };

const TAB = `flex-1 border-b-2 py-3 ${typeClasses['body-sm']}`;
const IDLE_TAB = `${TAB} border-border text-text-muted`;
const ACCENT_TONE = 'border-accent text-accent-text';
const shownTab = (tone: string): string => `${TAB} ${tone} font-semibold`;
const SHEET_STRIP = 'flex shrink-0 bg-surface';

export type SheetBarProps = {
  readonly titleId: string;
  readonly title: string;
  readonly children: ReactNode;
};

export function SheetBar({ titleId, title, children }: SheetBarProps): ReactNode {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <h2 id={titleId} className={`${typeClasses.body} font-semibold`}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function SheetTabs<Tab extends string>({
  tabs,
  shown,
  onShow,
  tabId,
  panelId,
  label,
  shownTone,
  look,
}: SheetTabsProps<Tab>): ReactNode {
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = ACROSS_STEPS[event.key];
    const next = step === undefined ? undefined : tabs[step(index, tabs.length)];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onShow(next);
    buttons.current[next]?.focus();
  };

  return (
    <div role="tablist" className={look?.strip ?? SHEET_STRIP}>
      {tabs.map((tab, index) => (
        <button
          key={tab}
          id={tabId(tab)}
          ref={(element) => {
            buttons.current[tab] = element;
          }}
          type="button"
          role="tab"
          aria-selected={shown === tab}
          aria-controls={panelId(tab)}
          tabIndex={shown === tab ? 0 : -1}
          onClick={() => {
            onShow(tab);
          }}
          onKeyDown={(event) => {
            move(event, index);
          }}
          className={
            shown === tab
              ? (look?.shown ?? shownTab(shownTone?.(tab) ?? ACCENT_TONE))
              : (look?.idle ?? IDLE_TAB)
          }
        >
          {label(tab)}
        </button>
      ))}
    </div>
  );
}

const CLICK_AFTER_SWIPE_MS = 500;

const SLIDE_MS = 200;

const SLIDE_EASING = 'ease-out';

const NON_TEXT_INPUTS = ['radio', 'checkbox', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color']
  .map((type) => `[type="${type}"]`)
  .join(', ');

const TEXT_ENTRY = `textarea, [contenteditable], input:not(${NON_TEXT_INPUTS})`;

type Press = {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly start: SwipePoint;
};

export type SheetPanelsProps<Tab extends string> = {
  readonly tabs: readonly Tab[];
  readonly shown: Tab;
  readonly onShow: (tab: Tab) => void;
  readonly tabId: (tab: Tab) => string;
  readonly className?: string;
  readonly children: ReactNode;
};

export function SheetPanels<Tab extends string>({
  tabs,
  shown,
  onShow,
  tabId,
  className,
  children,
}: SheetPanelsProps<Tab>): ReactNode {
  const area = useRef<HTMLDivElement>(null);
  const previous = useRef<Tab>(shown);
  const press = useRef<Press | undefined>(undefined);
  const swipedAt = useRef<number | undefined>(undefined);

  const stripShown = (): boolean => document.getElementById(tabId(shown))?.checkVisibility() === true;

  useLayoutEffect(() => {
    const from = slideFrom(tabs.indexOf(previous.current), tabs.indexOf(shown));
    previous.current = shown;
    if (from === undefined || !stripShown() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const incoming = area.current?.querySelector<HTMLElement>(
      `[role="tabpanel"][aria-labelledby="${tabId(shown)}"]`,
    );
    incoming?.animate(
      [{ transform: `translateX(${from === 'right' ? '100%' : '-100%'})` }, { transform: 'translateX(0)' }],
      { duration: SLIDE_MS, easing: SLIDE_EASING },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on a change of shown tab alone
  }, [shown]);

  const begin = (event: PointerEvent<HTMLDivElement>): void => {
    swipedAt.current = undefined;
    const startsInTextEntry = event.target instanceof Element && event.target.closest(TEXT_ENTRY) !== null;
    press.current =
      startsInTextEntry || !event.isPrimary || !stripShown()
        ? undefined
        : {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            start: { x: event.clientX, y: event.clientY },
          };
  };

  const end = (event: PointerEvent<HTMLDivElement>): void => {
    const current = press.current;
    press.current = undefined;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const target = swipeTarget({
      start: current.start,
      end: { x: event.clientX, y: event.clientY },
      screenWidth: window.innerWidth,
      pointerType: current.pointerType,
      tabCount: tabs.length,
      shownIndex: tabs.indexOf(shown),
    });
    const next = target === undefined ? undefined : tabs[target];
    if (next !== undefined) {
      swipedAt.current = event.timeStamp;
      onShow(next);
    }
  };

  const swallowClick = (event: MouseEvent<HTMLDivElement>): void => {
    const at = swipedAt.current;
    swipedAt.current = undefined;
    if (at !== undefined && event.timeStamp - at < CLICK_AFTER_SWIPE_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      ref={area}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerCancel={() => {
        press.current = undefined;
      }}
      onClickCapture={swallowClick}
      className={`touch-pan-y overflow-x-clip ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
