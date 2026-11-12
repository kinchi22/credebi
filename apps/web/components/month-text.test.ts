import { describe, expect, it } from 'vitest';
import { GRID_STEPS, monthAfter, monthText, monthTyped, shownMonth } from './month-text';

describe('monthText', () => {
  it('writes a calendar month as year, slash, month', () => {
    expect(monthText('2026-11')).toBe('2026/11');
    expect(monthText('0987-01')).toBe('0987/01');
  });
});

describe('monthTyped', () => {
  it('reads a year and a month joined by a hyphen or a slash', () => {
    expect(monthTyped('2026-11')).toBe('2026-11');
    expect(monthTyped('2026/11')).toBe('2026-11');
    expect(monthTyped('2026/12')).toBe('2026-12');
  });

  it('pads a single-digit month with a zero', () => {
    expect(monthTyped('2026-1')).toBe('2026-01');
    expect(monthTyped('2026/9')).toBe('2026-09');
  });

  it('ignores the space around the month typed', () => {
    expect(monthTyped(' 2026/03 ')).toBe('2026-03');
  });

  it('reads no month from anything else', () => {
    for (const typed of ['', 'June 2026', '2026/13', '2026/0', '2026/00', '26/06', '2026-06-15', '2026/123', '2026.06', '12026/01', '2026/01x', '2026/0x1']) {
      expect(monthTyped(typed)).toBeUndefined();
    }
  });
});

describe('shownMonth', () => {
  it('shows a calendar month as year, slash, month', () => {
    expect(shownMonth('2026-06')).toBe('2026/06');
  });

  it('shows anything else as it is', () => {
    expect(shownMonth('')).toBe('');
    expect(shownMonth('2026-13')).toBe('2026-13');
  });
});

describe('monthAfter', () => {
  it('counts months forward and back across the turn of a year', () => {
    expect(monthAfter('2026-11', 1)).toBe('2026-12');
    expect(monthAfter('2026-12', 1)).toBe('2027-01');
    expect(monthAfter('2026-01', -1)).toBe('2025-12');
    expect(monthAfter('2026-06', 12)).toBe('2027-06');
    expect(monthAfter('2026-06', -12)).toBe('2025-06');
    expect(monthAfter('0987-01', -1)).toBe('0986-12');
  });
});

describe('GRID_STEPS', () => {
  const stepped = (key: string, month: string): string | undefined => {
    const step = GRID_STEPS[key];
    return step === undefined ? undefined : monthAfter(month, step);
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
