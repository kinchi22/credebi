import {
  calendarDay,
  firstDayOfLastMonths,
  lastDayOfNextMonths,
  monthOf,
  yearOf,
  type DayRange,
} from './search-range';

export type Quarter = 1 | 2 | 3 | 4;

export type YearPreset = {
  readonly year: number;
  readonly range: DayRange;
};

export type QuarterPreset = YearPreset & {
  readonly quarter: Quarter;
};

export type MonthPreset = YearPreset & {
  readonly month: number;
};

export type PresetRow<Preset> = {
  readonly year: number;
  readonly presets: readonly Preset[];
};

export type RelativeDirection = 'last' | 'next' | 'around';

export type RelativePreset = {
  readonly direction: RelativeDirection;
  readonly months: number;
  readonly range: DayRange;
};

export type CurrentPeriod = {
  readonly year: number;
  readonly quarter: Quarter;
  readonly month: number;
};

type YearSpan = {
  readonly back: number;
  readonly ahead: number;
};

const YEAR_SPAN: YearSpan = { back: 10, ahead: 5 };
const QUARTER_SPAN: YearSpan = { back: 5, ahead: 3 };
const MONTH_SPAN: YearSpan = { back: 3, ahead: 2 };

const QUARTERS: readonly Quarter[] = [1, 2, 3, 4];
const MONTHS_IN_A_QUARTER = 3;
const MONTHS_IN_A_YEAR = 12;

const RELATIVE_MONTHS: Readonly<Record<RelativeDirection, readonly number[]>> = {
  last: [1, 3, 6, 12, 24, 36],
  next: [1, 3, 6, 12],
  around: [1, 3, 6, 12],
};

export const RELATIVE_DIRECTIONS: readonly RelativeDirection[] = ['last', 'next', 'around'];

function yearsAround(today: string, span: YearSpan): number[] {
  const first = yearOf(today) - span.back;
  return Array.from({ length: span.back + span.ahead + 1 }, (_, offset) => first + offset);
}

function monthsRange(year: number, firstMonthIndex: number, months: number): DayRange {
  return {
    from: calendarDay(year, firstMonthIndex, 1),
    to: calendarDay(year, firstMonthIndex + months, 0),
  };
}

export function yearPresets(today: string): readonly YearPreset[] {
  return yearsAround(today, YEAR_SPAN).map((year) => ({
    year,
    range: monthsRange(year, 0, MONTHS_IN_A_YEAR),
  }));
}

export function quarterPresets(today: string): readonly PresetRow<QuarterPreset>[] {
  return yearsAround(today, QUARTER_SPAN).map((year) => ({
    year,
    presets: QUARTERS.map((quarter) => ({
      year,
      quarter,
      range: monthsRange(year, (quarter - 1) * MONTHS_IN_A_QUARTER, MONTHS_IN_A_QUARTER),
    })),
  }));
}

export function monthPresets(today: string): readonly PresetRow<MonthPreset>[] {
  return yearsAround(today, MONTH_SPAN).map((year) => ({
    year,
    presets: Array.from({ length: MONTHS_IN_A_YEAR }, (_, monthIndex) => ({
      year,
      month: monthIndex + 1,
      range: monthsRange(year, monthIndex, 1),
    })),
  }));
}

function relativeRange(today: string, direction: RelativeDirection, months: number): DayRange {
  return {
    from: direction === 'next' ? today : firstDayOfLastMonths(today, months),
    to: direction === 'last' ? today : lastDayOfNextMonths(today, months),
  };
}

export function relativePresets(today: string): readonly RelativePreset[] {
  return RELATIVE_DIRECTIONS.flatMap((direction) =>
    RELATIVE_MONTHS[direction].map((months) => ({
      direction,
      months,
      range: relativeRange(today, direction, months),
    })),
  );
}

export function currentPeriod(today: string): CurrentPeriod {
  const month = monthOf(today);
  return {
    year: yearOf(today),
    quarter: Math.ceil(month / MONTHS_IN_A_QUARTER) as Quarter,
    month,
  };
}
