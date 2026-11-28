import { describe, expect, it } from 'vitest';
import { GRID_STEPS, monthsOfYear, monthText, steppedMonth } from './month-text';

describe('monthText', () => {
  it('writes a calendar month as year, slash, month', () => {
    expect(monthText('2026-11')).toBe('2026/11');
    expect(monthText('0987-01')).toBe('0987/01');
  });
});

describe('steppedMonth', () => {
  it('counts months forward and back across the turn of a year', () => {
    expect(steppedMonth('2026-12', 1)).toBe('2027-01');
    expect(steppedMonth('2026-01', -1)).toBe('2025-12');
    expect(steppedMonth('2026-06', -12)).toBe('2025-06');
  });

  it('reaches the first and the last calendar month there is', () => {
    expect(steppedMonth('0001-02', -1)).toBe('0001-01');
    expect(steppedMonth('9999-11', 1)).toBe('9999-12');
  });

  it('steps nowhere before the first calendar month or after the last', () => {
    expect(steppedMonth('0001-01', -1)).toBeUndefined();
    expect(steppedMonth('0001-06', -12)).toBeUndefined();
    expect(steppedMonth('9999-12', 1)).toBeUndefined();
    expect(steppedMonth('9999-06', 12)).toBeUndefined();
  });
});

describe('monthsOfYear', () => {
  it("lists the twelve months of the month's year, January first", () => {
    const months = monthsOfYear('2026-06');

    expect(months).toHaveLength(12);
    expect(months.at(0)).toBe('2026-01');
    expect(months.at(8)).toBe('2026-09');
    expect(months.at(-1)).toBe('2026-12');
  });

  it('lists the same months from any month of the year', () => {
    expect(monthsOfYear('0987-12')).toEqual(monthsOfYear('0987-01'));
    expect(monthsOfYear('0987-01').at(0)).toBe('0987-01');
  });
});

describe('GRID_STEPS', () => {
  const stepped = (key: string, month: string): string | undefined => {
    const step = GRID_STEPS[key];
    return step === undefined ? undefined : steppedMonth(month, step);
  };

  it('moves a month across with the side arrows and a row of four with the up and down arrows', () => {
    expect(stepped('ArrowRight', '2026-12')).toBe('2027-01');
    expect(stepped('ArrowLeft', '2026-12')).toBe('2026-11');
    expect(stepped('ArrowDown', '2026-02')).toBe('2026-06');
    expect(stepped('ArrowUp', '2026-06')).toBe('2026-02');
  });

  it('moves to the next year with Page Up and to the previous one with Page Down', () => {
    expect(stepped('PageUp', '2026-12')).toBe('2027-12');
    expect(stepped('PageDown', '2027-11')).toBe('2026-11');
  });

  it('takes no other key', () => {
    expect(stepped('Enter', '2026-06')).toBeUndefined();
    expect(stepped('Home', '2026-06')).toBeUndefined();
  });
});
