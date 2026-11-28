import { describe, expect, it } from 'vitest';
import { DAY_STEPS, monthCells, sameDayIn, steppedDay, steppedDayByMonths, weekdayOf } from './day-grid';

const movedDay = (day: string, key: string, shift: boolean): string | undefined => DAY_STEPS[key]?.(day, shift);

const own = (month: string): readonly (string | undefined)[] => monthCells(month).filter((cell) => cell !== undefined);

describe('monthCells', () => {
  it('leads with one blank per weekday before the first, Sunday first', () => {
    const cells = monthCells('2026-09');
    expect(cells.slice(0, 3)).toEqual([undefined, undefined, '2026-09-01']);
    expect(cells).toHaveLength(2 + 30);
    expect(cells.at(-1)).toBe('2026-09-30');
  });

  it('starts a month that begins on Sunday with no blanks', () => {
    expect(monthCells('2026-02')[0]).toBe('2026-02-01');
    expect(monthCells('2026-02')).toHaveLength(28);
  });

  it('counts a leap February as 29 days and a common one as 28', () => {
    expect(own('2024-02')).toHaveLength(29);
    expect(own('2025-02')).toHaveLength(28);
    expect(own('1900-02')).toHaveLength(28);
    expect(own('2000-02')).toHaveLength(29);
  });

  it('places the first days of the earliest and latest months on their weekdays', () => {
    expect(monthCells('0001-01').indexOf('0001-01-01')).toBe(1);
    expect(monthCells('9999-12').indexOf('9999-12-01')).toBe(3);
  });
});

describe('weekdayOf', () => {
  it('numbers Sunday 0 to Saturday 6', () => {
    expect(weekdayOf('2026-09-13')).toBe(0);
    expect(weekdayOf('2026-09-19')).toBe(6);
    expect(weekdayOf('0001-01-01')).toBe(1);
  });
});

describe('steppedDay', () => {
  it('crosses month and year ends', () => {
    expect(steppedDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(steppedDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(steppedDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(steppedDay('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('stops at 0001-01-01 and 9999-12-31', () => {
    expect(steppedDay('0001-01-01', -1)).toBeUndefined();
    expect(steppedDay('0001-01-03', -3)).toBeUndefined();
    expect(steppedDay('0001-01-03', -2)).toBe('0001-01-01');
    expect(steppedDay('9999-12-31', 1)).toBeUndefined();
    expect(steppedDay('9999-12-30', 1)).toBe('9999-12-31');
  });
});

describe('steppedDayByMonths', () => {
  it('keeps the day number, clamped to the target month', () => {
    expect(steppedDayByMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(steppedDayByMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(steppedDayByMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(steppedDayByMonths('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('stops outside 0001-01 to 9999-12', () => {
    expect(steppedDayByMonths('0001-01-15', -1)).toBeUndefined();
    expect(steppedDayByMonths('0001-06-15', -12)).toBeUndefined();
    expect(steppedDayByMonths('0001-01-15', 1)).toBe('0001-02-15');
    expect(steppedDayByMonths('9999-12-15', 1)).toBeUndefined();
    expect(steppedDayByMonths('9999-12-15', -1)).toBe('9999-11-15');
  });
});

describe('sameDayIn', () => {
  it('keeps the day number in the other month, clamped to its length', () => {
    expect(sameDayIn('2026-09-20', '2026-03')).toBe('2026-03-20');
    expect(sameDayIn('2026-03-31', '2026-02')).toBe('2026-02-28');
    expect(sameDayIn('2026-03-31', '2028-02')).toBe('2028-02-29');
    expect(sameDayIn('2026-03-12', '2026-03')).toBe('2026-03-12');
  });
});

describe('movedDay', () => {
  const from = '2026-09-15';

  it('moves a day and a week with the arrows', () => {
    expect(movedDay(from, 'ArrowRight', false)).toBe('2026-09-16');
    expect(movedDay(from, 'ArrowLeft', false)).toBe('2026-09-14');
    expect(movedDay(from, 'ArrowDown', false)).toBe('2026-09-22');
    expect(movedDay(from, 'ArrowUp', false)).toBe('2026-09-08');
  });

  it('crosses into the neighbouring month past the end or the start', () => {
    expect(movedDay('2026-09-30', 'ArrowRight', false)).toBe('2026-10-01');
    expect(movedDay('2026-10-01', 'ArrowLeft', false)).toBe('2026-09-30');
    expect(movedDay('2026-09-30', 'ArrowDown', false)).toBe('2026-10-07');
  });

  it('goes to the start and the end of the week, staying put on them', () => {
    expect(movedDay(from, 'Home', false)).toBe('2026-09-13');
    expect(movedDay('2026-09-13', 'Home', false)).toBe('2026-09-13');
    expect(movedDay(from, 'End', false)).toBe('2026-09-19');
    expect(movedDay('2026-09-19', 'End', false)).toBe('2026-09-19');
  });

  it('moves a month with PageUp and PageDown, and a year with Shift', () => {
    expect(movedDay(from, 'PageUp', false)).toBe('2026-10-15');
    expect(movedDay(from, 'PageDown', false)).toBe('2026-08-15');
    expect(movedDay(from, 'PageUp', true)).toBe('2027-09-15');
    expect(movedDay(from, 'PageDown', true)).toBe('2025-09-15');
  });

  it('claims exactly the arrows, Home, End, PageUp and PageDown', () => {
    expect(Object.keys(DAY_STEPS).sort()).toEqual([
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'End',
      'Home',
      'PageDown',
      'PageUp',
    ]);
  });

  it('ignores any other key', () => {
    expect(movedDay(from, 'a', false)).toBeUndefined();
    expect(movedDay(from, 'Enter', false)).toBeUndefined();
  });

  it('stops at both ends of the calendar', () => {
    for (const key of ['ArrowLeft', 'ArrowUp', 'PageDown']) {
      expect(movedDay('0001-01-01', key, false)).toBeUndefined();
    }
    expect(movedDay('0001-01-01', 'PageDown', true)).toBeUndefined();
    for (const key of ['ArrowRight', 'ArrowDown', 'PageUp']) {
      expect(movedDay('9999-12-31', key, false)).toBeUndefined();
    }
    expect(movedDay('9999-12-31', 'PageUp', true)).toBeUndefined();
  });
});
