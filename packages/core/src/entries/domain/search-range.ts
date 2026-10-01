export type DayRange = {
  readonly from: string;
  readonly to: string;
};

const MILLISECONDS_IN_A_DAY = 86_400_000;

function utcDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, date);
  return instant;
}

function lastDateOfMonth(year: number, monthIndex: number): number {
  const instant = new Date(0);
  instant.setUTCFullYear(year, monthIndex + 1, 0);
  return instant.getUTCDate();
}

function dayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function monthBack(day: string): Date {
  const today = utcDay(day);
  const year = today.getUTCFullYear();
  const monthIndex = today.getUTCMonth() - 1;
  const back = new Date(0);
  back.setUTCFullYear(year, monthIndex, Math.min(today.getUTCDate(), lastDateOfMonth(year, monthIndex)));
  return back;
}

export function defaultSearchRange(today: string): DayRange {
  return {
    from: dayOf(new Date(monthBack(today).getTime() + MILLISECONDS_IN_A_DAY)),
    to: today,
  };
}
