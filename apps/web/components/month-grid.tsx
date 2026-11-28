'use client';

import { useTranslations } from 'next-intl';
import { monthOf, yearOf } from '@repo/core/entries';
import { ChevronIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { BARE_ICON_BUTTON, TODAY_MARK } from './control-classes';
import { GRID_STEPS, monthsOfYear, steppedMonth } from './month-text';
import { useMonthLabel } from './use-month-label';

const MONTHS_A_YEAR = 12;

const MONTH = `rounded-control px-2 py-2 ${typeClasses['body-dense']} hover:bg-ground`;
const CHOSEN_MONTH = 'bg-surface-chosen hover:bg-surface-chosen';
export const STEP_BUTTON = `size-8 ${BARE_ICON_BUTTON} disabled:opacity-50`;

const monthClass = (today: boolean, chosen: boolean): string =>
  [MONTH, today ? TODAY_MARK : 'text-text', chosen ? CHOSEN_MONTH : ''].join(' ');

export type MonthGridProps = {
  readonly start: string;
  readonly chosen: string | undefined;
  readonly today: string | undefined;
  readonly onPick: (month: string) => void;
};

export function MonthGrid({ start, chosen, today, onPick }: MonthGridProps): ReactNode {
  const t = useTranslations('monthInput');
  const presets = useTranslations('datePresets');
  const monthLabel = useMonthLabel();
  const [active, setActive] = useState(start);
  const buttons = useRef<Partial<Record<number, HTMLButtonElement | null>>>({});
  const previousYear = steppedMonth(active, -MONTHS_A_YEAR);
  const nextYear = steppedMonth(active, MONTHS_A_YEAR);

  useEffect(() => {
    buttons.current[monthOf(start)]?.focus();
  }, [start]);

  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = GRID_STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const next = steppedMonth(active, step);
    if (next === undefined) {
      return;
    }
    flushSync(() => {
      setActive(next);
    });
    buttons.current[monthOf(next)]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('previousYear')}
          disabled={previousYear === undefined}
          onClick={() => {
            if (previousYear !== undefined) setActive(previousYear);
          }}
          className={STEP_BUTTON}
        >
          <span className="inline-flex rotate-180">
            <ChevronIcon />
          </span>
        </button>
        <span className={`${typeClasses.date} font-semibold text-text`}>{String(yearOf(active)).padStart(4, '0')}</span>
        <button
          type="button"
          aria-label={t('nextYear')}
          disabled={nextYear === undefined}
          onClick={() => {
            if (nextYear !== undefined) setActive(nextYear);
          }}
          className={STEP_BUTTON}
        >
          <ChevronIcon />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1" onKeyDown={move}>
        {monthsOfYear(active).map((month) => {
          const number = monthOf(month);
          const isToday = month === today;
          return (
            <button
              key={number}
              ref={(element) => {
                buttons.current[number] = element;
              }}
              type="button"
              aria-label={monthLabel(month)}
              aria-current={isToday ? 'date' : undefined}
              tabIndex={month === active ? 0 : -1}
              onClick={() => {
                onPick(month);
              }}
              className={monthClass(isToday, month === chosen)}
            >
              {presets('month', { month: number })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
