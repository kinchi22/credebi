export type DayRange = {
  readonly from: string;
  readonly to: string;
};

export function calendarDay(year: number, monthIndex: number, date: number): string {
  const instant = new Date(0);
  instant.setUTCFullYear(year, monthIndex, date);
  return instant.toISOString().slice(0, 10);
}

export function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

export function monthOf(day: string): number {
  return Number(day.slice(5, 7));
}

function dateOf(day: string): number {
  return Number(day.slice(8, 10));
}

function lastDateOfMonth(year: number, monthIndex: number): number {
  return dateOf(calendarDay(year, monthIndex + 1, 0));
}

function monthsAfter(day: string, months: number): string {
  const year = yearOf(day);
  const monthIndex = monthOf(day) - 1 + months;
  return calendarDay(year, monthIndex, Math.min(dateOf(day), lastDateOfMonth(year, monthIndex)));
}

function daysAfter(day: string, days: number): string {
  return calendarDay(yearOf(day), monthOf(day) - 1, dateOf(day) + days);
}

export function firstDayOfLastMonths(today: string, months: number): string {
  return daysAfter(monthsAfter(today, -months), 1);
}

export function lastDayOfNextMonths(today: string, months: number): string {
  return daysAfter(monthsAfter(today, months), -1);
}

export function defaultSearchRange(today: string): DayRange {
  return { from: firstDayOfLastMonths(today, 1), to: today };
}
