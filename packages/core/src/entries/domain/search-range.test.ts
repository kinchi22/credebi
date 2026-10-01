import { describe, expect, it } from 'vitest';
import { defaultSearchRange } from './search-range';

describe('defaultSearchRange', () => {
  it('runs from the day after the same day a month back, through today', () => {
    expect(defaultSearchRange('2026-09-15')).toEqual({ from: '2026-08-16', to: '2026-09-15' });
  });

  it('takes the last day of a month back that has no such day before adding one', () => {
    expect(defaultSearchRange('2026-03-31')).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('takes the 29th of a leap February as the last day a month back', () => {
    expect(defaultSearchRange('2024-03-31')).toEqual({ from: '2024-03-01', to: '2024-03-31' });
    expect(defaultSearchRange('2024-03-29')).toEqual({ from: '2024-03-01', to: '2024-03-29' });
  });

  it('clamps a day that a short month back lacks, even when the month is not February', () => {
    expect(defaultSearchRange('2026-05-31')).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    expect(defaultSearchRange('2026-03-30')).toEqual({ from: '2026-03-01', to: '2026-03-30' });
  });

  it('keeps a day that the month back has, at the end of a long month', () => {
    expect(defaultSearchRange('2026-08-31')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(defaultSearchRange('2026-07-30')).toEqual({ from: '2026-07-01', to: '2026-07-30' });
    expect(defaultSearchRange('2026-02-28')).toEqual({ from: '2026-01-29', to: '2026-02-28' });
  });

  it('crosses the turn of the year back into December', () => {
    expect(defaultSearchRange('2026-01-15')).toEqual({ from: '2025-12-16', to: '2026-01-15' });
    expect(defaultSearchRange('2026-01-31')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('starts on the second of the month when today is the first', () => {
    expect(defaultSearchRange('2026-03-01')).toEqual({ from: '2026-02-02', to: '2026-03-01' });
  });

  it('crosses into the next month when the day a month back is the last of its month', () => {
    expect(defaultSearchRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('writes a year before 1000 with four digits', () => {
    expect(defaultSearchRange('0999-02-10')).toEqual({ from: '0999-01-11', to: '0999-02-10' });
  });
});
