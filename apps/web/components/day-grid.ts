import { daysAfter, lastDateOfMonth, monthOf, monthsAfter, yearOf } from '@repo/core/entries';
import { MONTHS_A_YEAR } from './month-text';

export type DayCell = string | undefined;

const FIRST_DAY = '0001-01-01';
const LAST_DAY = '9999-12-31';
const WEEK = 7;
const TWO_DIGITS = 2;

const withinCalendar = (day: string): string | undefined => (day >= FIRST_DAY && day <= LAST_DAY ? day : undefined);

export function weekdayOf(day: string): number {
  return new Date(day).getUTCDay();
}

export function monthCells(month: string): readonly DayCell[] {
  const blanks = Array.from<DayCell>({ length: weekdayOf(`${month}-01`) });
  const days = Array.from(
    { length: lastDateOfMonth(yearOf(month), monthOf(month) - 1) },
    (_, offset) => `${month}-${String(offset + 1).padStart(TWO_DIGITS, '0')}`,
  );
  return [...blanks, ...days];
}

export const steppedDay = (day: string, days: number): string | undefined => withinCalendar(daysAfter(day, days));

export const steppedDayByMonths = (day: string, months: number): string | undefined =>
  withinCalendar(monthsAfter(day, months));

export function sameDayIn(day: string, month: string): string {
  const apart = yearOf(month) * MONTHS_A_YEAR + monthOf(month) - (yearOf(day) * MONTHS_A_YEAR + monthOf(day));
  return steppedDayByMonths(day, apart) ?? day;
}

type DayStep = (day: string, shift: boolean) => string | undefined;

export const DAY_STEPS: Readonly<Record<string, DayStep>> = {
  ArrowLeft: (day) => steppedDay(day, -1),
  ArrowRight: (day) => steppedDay(day, 1),
  ArrowUp: (day) => steppedDay(day, -WEEK),
  ArrowDown: (day) => steppedDay(day, WEEK),
  Home: (day) => steppedDay(day, -weekdayOf(day)),
  End: (day) => steppedDay(day, WEEK - 1 - weekdayOf(day)),
  PageUp: (day, shift) => steppedDayByMonths(day, shift ? MONTHS_A_YEAR : 1),
  PageDown: (day, shift) => steppedDayByMonths(day, shift ? -MONTHS_A_YEAR : -1),
};

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
