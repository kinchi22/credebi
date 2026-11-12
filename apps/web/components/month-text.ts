import { calendarMonthSchema } from '@repo/contracts';

const TYPED_MONTH = /^\d{4}[-/]\d{1,2}$/;

const MONTHS_A_YEAR = 12;

const GRID_COLUMNS = 4;

export const monthText = (month: string): string => month.replace('-', '/');

export function monthTyped(text: string): string | undefined {
  const typed = text.trim();
  if (!TYPED_MONTH.test(typed)) {
    return undefined;
  }
  const number = Number(typed.slice(5));
  return number >= 1 && number <= MONTHS_A_YEAR
    ? `${typed.slice(0, 4)}-${String(number).padStart(2, '0')}`
    : undefined;
}

export const shownMonth = (value: string): string =>
  calendarMonthSchema.safeParse(value).success ? monthText(value) : value;

export function monthAfter(month: string, count: number): string {
  const index = Number(month.slice(0, 4)) * MONTHS_A_YEAR + Number(month.slice(5, 7)) - 1 + count;
  const year = Math.floor(index / MONTHS_A_YEAR);
  return `${String(year).padStart(4, '0')}-${String(index - year * MONTHS_A_YEAR + 1).padStart(2, '0')}`;
}

export const GRID_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -GRID_COLUMNS,
  ArrowDown: GRID_COLUMNS,
  PageUp: MONTHS_A_YEAR,
  PageDown: -MONTHS_A_YEAR,
};
