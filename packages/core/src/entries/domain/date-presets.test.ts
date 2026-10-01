import { describe, expect, it } from 'vitest';
import {
  currentPeriod,
  monthPresets,
  quarterPresets,
  relativePresets,
  yearPresets,
  type RelativePreset,
} from './date-presets';

const TODAY = '2026-09-15';

describe('yearPresets', () => {
  it('offers every calendar year from ten back to five ahead, in order', () => {
    expect(yearPresets(TODAY).map((preset) => preset.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031,
    ]);
  });

  it('runs each year from 1 January through 31 December', () => {
    const presets = yearPresets(TODAY);
    expect(presets[0]).toEqual({ year: 2016, range: { from: '2016-01-01', to: '2016-12-31' } });
    expect(presets.at(-1)).toEqual({ year: 2031, range: { from: '2031-01-01', to: '2031-12-31' } });
  });

  it('counts the years from the year of today, whatever day of it today is', () => {
    expect(yearPresets('2026-01-01')[0]?.year).toBe(2016);
    expect(yearPresets('2026-12-31').at(-1)?.year).toBe(2031);
  });

  it('writes a year before 1000 with four digits', () => {
    expect(yearPresets('1005-06-01')[0]).toEqual({ year: 995, range: { from: '0995-01-01', to: '0995-12-31' } });
  });
});

describe('quarterPresets', () => {
  it('lays the quarters out one row per year, from five years back to three ahead', () => {
    const rows = quarterPresets(TODAY);
    expect(rows.map((row) => row.year)).toEqual([2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029]);
    for (const row of rows) {
      expect(row.presets.map((preset) => [preset.year, preset.quarter])).toEqual([
        [row.year, 1],
        [row.year, 2],
        [row.year, 3],
        [row.year, 4],
      ]);
    }
  });

  it('runs each quarter from the first day of its first month through the last day of its third', () => {
    const row = quarterPresets(TODAY).find((candidate) => candidate.year === 2026);
    expect(row?.presets.map((preset) => preset.range)).toEqual([
      { from: '2026-01-01', to: '2026-03-31' },
      { from: '2026-04-01', to: '2026-06-30' },
      { from: '2026-07-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-12-31' },
    ]);
  });

  it('starts the first row on Q1 of the earliest year and ends the last on Q4 of the latest', () => {
    const rows = quarterPresets(TODAY);
    expect(rows[0]?.presets[0]?.range).toEqual({ from: '2021-01-01', to: '2021-03-31' });
    expect(rows.at(-1)?.presets.at(-1)?.range).toEqual({ from: '2029-10-01', to: '2029-12-31' });
  });
});

describe('monthPresets', () => {
  it('lays the months out one row per year, from three years back to two ahead', () => {
    const rows = monthPresets(TODAY);
    expect(rows.map((row) => row.year)).toEqual([2023, 2024, 2025, 2026, 2027, 2028]);
    for (const row of rows) {
      expect(row.presets.map((preset) => preset.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(row.presets.every((preset) => preset.year === row.year)).toBe(true);
    }
  });

  it('runs each month from its first day through its last', () => {
    const row = monthPresets(TODAY).find((candidate) => candidate.year === 2026);
    expect(row?.presets.map((preset) => preset.range)).toEqual([
      { from: '2026-01-01', to: '2026-01-31' },
      { from: '2026-02-01', to: '2026-02-28' },
      { from: '2026-03-01', to: '2026-03-31' },
      { from: '2026-04-01', to: '2026-04-30' },
      { from: '2026-05-01', to: '2026-05-31' },
      { from: '2026-06-01', to: '2026-06-30' },
      { from: '2026-07-01', to: '2026-07-31' },
      { from: '2026-08-01', to: '2026-08-31' },
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-10-31' },
      { from: '2026-11-01', to: '2026-11-30' },
      { from: '2026-12-01', to: '2026-12-31' },
    ]);
  });

  it('ends a leap February on the 29th', () => {
    const row = monthPresets(TODAY).find((candidate) => candidate.year === 2028);
    expect(row?.presets[1]?.range).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('starts the first row in January of the earliest year and ends the last in December of the latest', () => {
    const rows = monthPresets(TODAY);
    expect(rows[0]?.presets[0]?.range).toEqual({ from: '2023-01-01', to: '2023-01-31' });
    expect(rows.at(-1)?.presets.at(-1)?.range).toEqual({ from: '2028-12-01', to: '2028-12-31' });
  });
});

const named = (presets: readonly RelativePreset[]): string[] =>
  presets.map((preset) => `${preset.direction} ${String(preset.months)}`);

const rangeOf = (today: string, direction: RelativePreset['direction'], months: number) =>
  relativePresets(today).find((preset) => preset.direction === direction && preset.months === months)?.range;

describe('relativePresets', () => {
  it('offers the last 1 to 36 months, the next 1 to 12 and 1 to 12 either side, in that order', () => {
    expect(named(relativePresets(TODAY))).toEqual([
      'last 1',
      'last 3',
      'last 6',
      'last 12',
      'last 24',
      'last 36',
      'next 1',
      'next 3',
      'next 6',
      'next 12',
      'around 1',
      'around 3',
      'around 6',
      'around 12',
    ]);
  });

  it('runs the last months from the day after the same day that many months back, through today', () => {
    expect(rangeOf(TODAY, 'last', 1)).toEqual({ from: '2026-08-16', to: '2026-09-15' });
    expect(rangeOf(TODAY, 'last', 3)).toEqual({ from: '2026-06-16', to: '2026-09-15' });
    expect(rangeOf(TODAY, 'last', 6)).toEqual({ from: '2026-03-16', to: '2026-09-15' });
    expect(rangeOf(TODAY, 'last', 12)).toEqual({ from: '2025-09-16', to: '2026-09-15' });
    expect(rangeOf(TODAY, 'last', 24)).toEqual({ from: '2024-09-16', to: '2026-09-15' });
    expect(rangeOf(TODAY, 'last', 36)).toEqual({ from: '2023-09-16', to: '2026-09-15' });
  });

  it('runs the next months from today through the day before the same day that many months ahead', () => {
    expect(rangeOf(TODAY, 'next', 1)).toEqual({ from: '2026-09-15', to: '2026-10-14' });
    expect(rangeOf(TODAY, 'next', 3)).toEqual({ from: '2026-09-15', to: '2026-12-14' });
    expect(rangeOf(TODAY, 'next', 6)).toEqual({ from: '2026-09-15', to: '2027-03-14' });
    expect(rangeOf(TODAY, 'next', 12)).toEqual({ from: '2026-09-15', to: '2027-09-14' });
  });

  it('runs either side from the start of the last months through the end of the next', () => {
    expect(rangeOf(TODAY, 'around', 1)).toEqual({ from: '2026-08-16', to: '2026-10-14' });
    expect(rangeOf(TODAY, 'around', 3)).toEqual({ from: '2026-06-16', to: '2026-12-14' });
    expect(rangeOf(TODAY, 'around', 6)).toEqual({ from: '2026-03-16', to: '2027-03-14' });
    expect(rangeOf(TODAY, 'around', 12)).toEqual({ from: '2025-09-16', to: '2027-09-14' });
  });

  it('takes the last day of a month back that has no such day before adding one', () => {
    expect(rangeOf('2026-05-31', 'last', 3)).toEqual({ from: '2026-03-01', to: '2026-05-31' });
    expect(rangeOf('2024-08-31', 'last', 6)).toEqual({ from: '2024-03-01', to: '2024-08-31' });
    expect(rangeOf('2025-03-31', 'last', 1)).toEqual({ from: '2025-03-01', to: '2025-03-31' });
  });

  it('takes the last day of a month ahead that has no such day before taking one away', () => {
    expect(rangeOf('2026-01-31', 'next', 1)).toEqual({ from: '2026-01-31', to: '2026-02-27' });
    expect(rangeOf('2027-01-31', 'next', 1)).toEqual({ from: '2027-01-31', to: '2027-02-27' });
    expect(rangeOf('2028-01-31', 'next', 1)).toEqual({ from: '2028-01-31', to: '2028-02-28' });
    expect(rangeOf('2026-08-31', 'next', 3)).toEqual({ from: '2026-08-31', to: '2026-11-29' });
    expect(rangeOf('2026-03-31', 'around', 1)).toEqual({ from: '2026-03-01', to: '2026-04-29' });
  });

  it('keeps the day a month ahead has, at the end of a long month', () => {
    expect(rangeOf('2026-07-31', 'next', 1)).toEqual({ from: '2026-07-31', to: '2026-08-30' });
    expect(rangeOf('2026-12-31', 'next', 1)).toEqual({ from: '2026-12-31', to: '2027-01-30' });
  });

  it('crosses the turn of the year in both directions', () => {
    expect(rangeOf('2026-01-15', 'last', 3)).toEqual({ from: '2025-10-16', to: '2026-01-15' });
    expect(rangeOf('2026-11-15', 'next', 3)).toEqual({ from: '2026-11-15', to: '2027-02-14' });
  });

  it('starts on the second of the month when today is the first and the months are back', () => {
    expect(rangeOf('2026-03-01', 'last', 1)).toEqual({ from: '2026-02-02', to: '2026-03-01' });
  });

  it('ends on the last day of the month before when today is the first and the months are ahead', () => {
    expect(rangeOf('2026-03-01', 'next', 1)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
});

describe('currentPeriod', () => {
  it('names the year, the quarter and the month that hold today', () => {
    expect(currentPeriod(TODAY)).toEqual({ year: 2026, quarter: 3, month: 9 });
  });

  it('puts each month into its quarter', () => {
    const quarters = Array.from({ length: 12 }, (_, index) =>
      currentPeriod(`2026-${String(index + 1).padStart(2, '0')}-10`).quarter,
    );
    expect(quarters).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });

  it('holds the first and the last day of the year in the year they belong to', () => {
    expect(currentPeriod('2026-01-01')).toEqual({ year: 2026, quarter: 1, month: 1 });
    expect(currentPeriod('2026-12-31')).toEqual({ year: 2026, quarter: 4, month: 12 });
  });

  it('is a choice each family offers, and the one whose range holds today', () => {
    const period = currentPeriod(TODAY);
    const year = yearPresets(TODAY).find((preset) => preset.year === period.year);
    const quarter = quarterPresets(TODAY)
      .flatMap((row) => row.presets)
      .find((preset) => preset.year === period.year && preset.quarter === period.quarter);
    const month = monthPresets(TODAY)
      .flatMap((row) => row.presets)
      .find((preset) => preset.year === period.year && preset.month === period.month);
    expect([year?.range, quarter?.range, month?.range]).toEqual([
      { from: '2026-01-01', to: '2026-12-31' },
      { from: '2026-07-01', to: '2026-09-30' },
      { from: '2026-09-01', to: '2026-09-30' },
    ]);
  });
});
