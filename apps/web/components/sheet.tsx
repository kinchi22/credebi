'use client';

import { typeClasses } from '@repo/ui/type-classes';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ACROSS_STEPS } from './roving-focus';

export type SheetTabsProps<Tab extends string> = {
  readonly tabs: readonly Tab[];
  readonly shown: Tab;
  readonly onShow: (tab: Tab) => void;
  readonly tabId: (tab: Tab) => string;
  readonly panelId: (tab: Tab) => string;
  readonly label: (tab: Tab) => string;
  readonly shownTone?: (tab: Tab) => string;
  readonly look?: TabsLook;
};

export type TabsLook = {
  readonly strip: string;
  readonly idle: string;
  readonly shown: (tone: string) => string;
};

const TAB = `flex-1 border-b-2 py-3 ${typeClasses['body-sm']}`;
const IDLE_TAB = `${TAB} border-border text-text-muted`;
const ACCENT_TONE = 'border-accent text-accent-text';
const shownTab = (tone: string): string => `${TAB} ${tone} font-semibold`;

const SHEET_TABS: TabsLook = { strip: 'flex shrink-0 bg-surface', idle: IDLE_TAB, shown: shownTab };

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
  look = SHEET_TABS,
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
    <div role="tablist" className={look.strip}>
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
          className={shown === tab ? look.shown(shownTone?.(tab) ?? ACCENT_TONE) : look.idle}
        >
          {label(tab)}
        </button>
      ))}
    </div>
  );
}
