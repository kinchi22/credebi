'use client';

import { useTranslations } from 'next-intl';
import { ChevronIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { TODAY_MARK } from './control-classes';
import {
  DAY_KEYS,
  dayOfMonth,
  monthCells,
  monthOfDay,
  movedDay,
  sameDayIn,
  steppedDayByMonths,
  WEEKDAYS,
} from './day-grid';
import { MonthGrid, STEP_BUTTON } from './month-grid';
import { monthText } from './month-text';

export type DayPickerProps = {
  readonly start: string;
  readonly chosen: string | undefined;
  readonly today: string | undefined;
  readonly onPick: (day: string) => void;
};

type View = { readonly kind: 'days'; readonly start: string } | { readonly kind: 'months'; readonly from: string };

const DAY = `h-9 rounded-control ${typeClasses['body-dense']} hover:bg-ground`;
const CHOSEN_DAY = 'bg-surface-chosen hover:bg-surface-chosen';
const HEADING = `${typeClasses.date} rounded-control px-2 py-1 font-semibold text-text hover:bg-ground`;
const WEEKDAY = `flex h-8 items-center justify-center ${typeClasses['body-sm']} text-text-muted`;

const dayClass = (today: boolean, chosen: boolean): string =>
  [DAY, today ? TODAY_MARK : 'text-text', chosen ? CHOSEN_DAY : ''].join(' ');

type DayGridProps = DayPickerProps & {
  readonly onChooseMonth: (active: string) => void;
};

function DayGrid({ start, chosen, today, onPick, onChooseMonth }: DayGridProps): ReactNode {
  const t = useTranslations('dayInput');
  const [active, setActive] = useState(start);
  const buttons = useRef<Partial<Record<number, HTMLButtonElement | null>>>({});
  const month = monthOfDay(active);
  const previousMonth = steppedDayByMonths(active, -1);
  const nextMonth = steppedDayByMonths(active, 1);

  useEffect(() => {
    buttons.current[dayOfMonth(start)]?.focus();
  }, [start]);

  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!DAY_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    const next = movedDay(active, event.key, event.shiftKey);
    if (next === undefined) {
      return;
    }
    flushSync(() => {
      setActive(next);
    });
    buttons.current[dayOfMonth(next)]?.focus();
  };

  return (
    <div className="grid grid-cols-7 gap-1" onKeyDown={move}>
      <button
        type="button"
        aria-label={t('previousMonth')}
        aria-disabled={previousMonth === undefined}
        onClick={() => {
          if (previousMonth !== undefined) setActive(previousMonth);
        }}
        className={`${STEP_BUTTON} aria-disabled:opacity-50 justify-self-start`}
      >
        <span className="inline-flex rotate-180">
          <ChevronIcon />
        </span>
      </button>
      <button
        type="button"
        aria-label={t('chooseMonthAndYear')}
        onClick={() => {
          onChooseMonth(active);
        }}
        className={`${HEADING} col-span-5 justify-self-center`}
      >
        {monthText(month)}
      </button>
      <button
        type="button"
        aria-label={t('nextMonth')}
        aria-disabled={nextMonth === undefined}
        onClick={() => {
          if (nextMonth !== undefined) setActive(nextMonth);
        }}
        className={`${STEP_BUTTON} aria-disabled:opacity-50 justify-self-end`}
      >
        <ChevronIcon />
      </button>
      {WEEKDAYS.map((weekday) => (
        <span key={weekday} className={WEEKDAY}>
          {t(`weekdays.${weekday}`)}
        </span>
      ))}
      {monthCells(month).map((cell, index) =>
        cell === undefined ? (
          <span key={`blank-${String(index)}`} />
        ) : (
          <button
            key={cell}
            ref={(element) => {
              buttons.current[dayOfMonth(cell)] = element;
            }}
            type="button"
            aria-current={cell === today ? 'date' : undefined}
            tabIndex={cell === active ? 0 : -1}
            onClick={() => {
              onPick(cell);
            }}
            className={dayClass(cell === today, cell === chosen)}
          >
            {dayOfMonth(cell)}
          </button>
        ),
      )}
    </div>
  );
}

export function DayPicker({ start, chosen, today, onPick }: DayPickerProps): ReactNode {
  const [view, setView] = useState<View>({ kind: 'days', start });

  if (view.kind === 'months') {
    return (
      <MonthGrid
        start={monthOfDay(view.from)}
        chosen={chosen === undefined ? undefined : monthOfDay(chosen)}
        today={today === undefined ? undefined : monthOfDay(today)}
        onPick={(month) => {
          setView({ kind: 'days', start: sameDayIn(view.from, month) });
        }}
      />
    );
  }

  return (
    <DayGrid
      start={view.start}
      chosen={chosen}
      today={today}
      onPick={onPick}
      onChooseMonth={(active) => {
        setView({ kind: 'months', from: active });
      }}
    />
  );
}
