const FIRST_YEAR = 1;
const LAST_YEAR = 9999;
const WEEK = 7;
const MONTHS_A_YEAR = 12;
const YEAR_WIDTH = 4;
const TWO_DIGITS = 2;

export type DayCell = string | undefined;

const utcOf = (year: number, month: number, day: number): Date => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
};

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

function isoOf(date: Date): string | undefined {
  const year = date.getUTCFullYear();
  if (year < FIRST_YEAR || year > LAST_YEAR) {
    return undefined;
  }
  return `${pad(year, YEAR_WIDTH)}-${pad(date.getUTCMonth() + 1, TWO_DIGITS)}-${pad(date.getUTCDate(), TWO_DIGITS)}`;
}

const partsOf = (iso: string): { readonly year: number; readonly month: number; readonly day: number } => ({
  year: Number(iso.slice(0, YEAR_WIDTH)),
  month: Number(iso.slice(5, 7)),
  day: Number(iso.slice(8, 10)),
});

const lengthOfMonth = (year: number, month: number): number => utcOf(year, month + 1, 0).getUTCDate();

export const dayOfMonth = (iso: string): number => partsOf(iso).day;

export const monthOfDay = (iso: string): string => iso.slice(0, 7);

export function weekdayOf(iso: string): number {
  const { year, month, day } = partsOf(iso);
  return utcOf(year, month, day).getUTCDay();
}

export function monthCells(month: string): readonly DayCell[] {
  const year = Number(month.slice(0, YEAR_WIDTH));
  const number = Number(month.slice(5, 7));
  const blanks = Array.from<DayCell>({ length: utcOf(year, number, 1).getUTCDay() });
  const days = Array.from({ length: lengthOfMonth(year, number) }, (_, offset) => offset + 1);
  return [...blanks, ...days.map((day) => `${month}-${pad(day, TWO_DIGITS)}`)];
}

export function steppedDay(iso: string, days: number): string | undefined {
  const { year, month, day } = partsOf(iso);
  return isoOf(utcOf(year, month, day + days));
}

export function steppedDayByMonths(iso: string, months: number): string | undefined {
  const { year, month, day } = partsOf(iso);
  const index = year * MONTHS_A_YEAR + (month - 1) + months;
  const targetYear = Math.floor(index / MONTHS_A_YEAR);
  const targetMonth = (index % MONTHS_A_YEAR) + 1;
  return isoOf(utcOf(targetYear, targetMonth, Math.min(day, lengthOfMonth(targetYear, targetMonth))));
}

export function sameDayIn(iso: string, month: string): string {
  const { year, month: number } = partsOf(iso);
  const target = Number(month.slice(0, YEAR_WIDTH)) * MONTHS_A_YEAR + Number(month.slice(5, 7));
  return steppedDayByMonths(iso, target - (year * MONTHS_A_YEAR + number)) ?? iso;
}

export function movedDay(iso: string, key: string, shift: boolean): string | undefined {
  const weekday = weekdayOf(iso);
  switch (key) {
    case 'ArrowLeft':
      return steppedDay(iso, -1);
    case 'ArrowRight':
      return steppedDay(iso, 1);
    case 'ArrowUp':
      return steppedDay(iso, -WEEK);
    case 'ArrowDown':
      return steppedDay(iso, WEEK);
    case 'Home':
      return steppedDay(iso, -weekday);
    case 'End':
      return steppedDay(iso, WEEK - 1 - weekday);
    case 'PageUp':
      return steppedDayByMonths(iso, shift ? MONTHS_A_YEAR : 1);
    case 'PageDown':
      return steppedDayByMonths(iso, shift ? -MONTHS_A_YEAR : -1);
    default:
      return undefined;
  }
}

export const DAY_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
