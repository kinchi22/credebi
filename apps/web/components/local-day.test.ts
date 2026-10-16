import { describe, expect, it } from 'vitest';
import { localDayOf } from './local-day';

describe('localDayOf', () => {
  it('writes the day as year, month and day', () => {
    expect(localDayOf(new Date(2026, 10, 23, 12, 0))).toBe('2026-11-23');
  });

  it('pads a single-digit month and day with a zero', () => {
    expect(localDayOf(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('pads a year before 1000 to four digits', () => {
    const date = new Date(2026, 0, 5, 12, 0);
    date.setFullYear(987);
    expect(localDayOf(date)).toBe('0987-01-05');
  });

  it('keeps the local day at the last minute of it', () => {
    expect(localDayOf(new Date(2026, 2, 9, 23, 59))).toBe('2026-03-09');
  });

  it('keeps the local day at the first minute of it', () => {
    expect(localDayOf(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});
