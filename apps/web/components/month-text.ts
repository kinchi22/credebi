import { calendarMonthSchema } from '@repo/contracts';
import { monthAfter, monthOf } from '@repo/core/entries';

const SEPARATORS: ReadonlySet<string> = new Set(['-', '/']);

const MONTHS_A_YEAR = 12;

const GRID_COLUMNS = 4;

const isCalendarMonth = (month: string): boolean => calendarMonthSchema.safeParse(month).success;

export const monthText = (month: string): string => month.replace('-', '/');

export function monthTyped(text: string): string | undefined {
  const typed = text.trim();
  if (!SEPARATORS.has(typed.charAt(4))) {
    return undefined;
  }
  const month = `${typed.slice(0, 4)}-${typed.slice(5).padStart(2, '0')}`;
  return isCalendarMonth(month) ? month : undefined;
}

export const shownMonth = (value: string): string => (isCalendarMonth(value) ? monthText(value) : value);

export function steppedMonth(month: string, count: number): string | undefined {
  const stepped = monthAfter(month, count);
  return isCalendarMonth(stepped) ? stepped : undefined;
}

export function monthsOfYear(month: string): readonly string[] {
  const first = monthAfter(month, 1 - monthOf(month));
  return Array.from({ length: MONTHS_A_YEAR }, (_, offset) => monthAfter(first, offset));
}

export const GRID_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -GRID_COLUMNS,
  ArrowDown: GRID_COLUMNS,
  PageUp: MONTHS_A_YEAR,
  PageDown: -MONTHS_A_YEAR,
};
