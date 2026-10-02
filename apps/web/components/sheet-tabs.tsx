'use client';

import { typeClasses } from '@repo/ui/type-classes';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export type SheetTabsProps<Tab extends string> = {
  readonly tabs: readonly Tab[];
  readonly shown: Tab;
  readonly onShow: (tab: Tab) => void;
  readonly tabId: (tab: Tab) => string;
  readonly panelId: (tab: Tab) => string;
  readonly label: (tab: Tab) => string;
};

const TAB = `flex-1 border-b-2 py-3 ${typeClasses['body-sm']}`;
const IDLE_TAB = `${TAB} border-border text-text-muted`;
const SHOWN_TAB = `${TAB} border-accent font-semibold text-accent-text`;

const STEPS: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowLeft: (index, count) => (index + count - 1) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

export function SheetTabs<Tab extends string>({
  tabs,
  shown,
  onShow,
  tabId,
  panelId,
  label,
}: SheetTabsProps<Tab>): ReactNode {
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = STEPS[event.key];
    const next = step === undefined ? undefined : tabs[step(index, tabs.length)];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onShow(next);
    buttons.current[next]?.focus();
  };

  return (
    <div role="tablist" className="flex shrink-0 bg-surface px-2">
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
          className={shown === tab ? SHOWN_TAB : IDLE_TAB}
        >
          {label(tab)}
        </button>
      ))}
    </div>
  );
}
