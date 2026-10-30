import { describe, expect, it } from 'vitest';
import { compactAmount, fittedDomain, monthTick } from './chart-axis';

describe('fittedDomain', () => {
  it('spans from zero to the largest value, rounded up to a multiple of half its power of ten, when every value is positive', () => {
    expect(fittedDomain([300, 1200, 700])).toEqual([0, 1500]);
    expect(fittedDomain([1_234_567])).toEqual([0, 1_500_000]);
    expect(fittedDomain([6_000_001])).toEqual([0, 6_500_000]);
  });

  it('keeps a largest value already on a multiple of half its power of ten', () => {
    expect(fittedDomain([10_000_000, 5])).toEqual([0, 10_000_000]);
    expect(fittedDomain([500])).toEqual([0, 500]);
  });

  it('spans from the smallest value, rounded down the same way, to zero when every value is negative', () => {
    expect(fittedDomain([-300, -1200, -700])).toEqual([-1500, 0]);
  });

  it('rounds each end on its own when the values straddle zero', () => {
    expect(fittedDomain([-2000, 3000, 7200])).toEqual([-2000, 7500]);
  });

  it('spans zero to one with no values or only zeros, so the axis is never a single point', () => {
    expect(fittedDomain([])).toEqual([0, 1]);
    expect(fittedDomain([0, 0])).toEqual([0, 1]);
  });

  it('rounds a value under ten away from zero to a whole number', () => {
    expect(fittedDomain([3])).toEqual([0, 3]);
    expect(fittedDomain([-0.4, 2.2])).toEqual([-1, 3]);
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
