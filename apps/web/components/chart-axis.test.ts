import { describe, expect, it } from 'vitest';
import { compactAmount, fittedDomain, monthTick } from './chart-axis';

describe('fittedDomain', () => {
  it('spans from zero to the largest value when every value is positive', () => {
    expect(fittedDomain([300, 1200, 700])).toEqual([0, 1200]);
  });

  it('spans from the smallest value to zero when every value is negative', () => {
    expect(fittedDomain([-300, -1200, -700])).toEqual([-1200, 0]);
  });

  it('spans from the smallest to the largest value when they straddle zero', () => {
    expect(fittedDomain([-2000, 3000, 5000])).toEqual([-2000, 5000]);
  });

  it('is zero alone with no values or only zeros', () => {
    expect(fittedDomain([])).toEqual([0, 0]);
    expect(fittedDomain([0, 0])).toEqual([0, 0]);
  });
});

describe('monthTick', () => {
  it('names a calendar month by the last two digits of its year and its month', () => {
    expect(monthTick('2026-06')).toBe('26.06');
    expect(monthTick('1999-12')).toBe('99.12');
    expect(monthTick('0007-01')).toBe('07.01');
  });
});

describe('compactAmount', () => {
  it('shortens thousands, millions and billions with one fraction digit at most', () => {
    expect(compactAmount(1500)).toBe('1.5K');
    expect(compactAmount(10_000_000)).toBe('10M');
    expect(compactAmount(2_340_000_000)).toBe('2.3B');
  });

  it('shows an amount under a thousand and zero as they are', () => {
    expect(compactAmount(999)).toBe('999');
    expect(compactAmount(0)).toBe('0');
  });

  it('keeps the minus sign of a negative amount', () => {
    expect(compactAmount(-90_000_000)).toBe('-90M');
  });
});
