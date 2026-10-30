import { describe, expect, it } from 'vitest';
import { compactAmount, fittedTicks, monthTick } from './chart-axis';

describe('fittedTicks', () => {
  it('runs from zero to the largest value in even steps, each the smallest of 1, 2, 2.5 or 5 times a power of ten that covers a quarter of the span', () => {
    expect(fittedTicks([300, 1200, 700])).toEqual([0, 500, 1000, 1500]);
    expect(fittedTicks([1_234_567])).toEqual([0, 500_000, 1_000_000, 1_500_000]);
    expect(fittedTicks([10_000_000, 5])).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
    expect(fittedTicks([8000])).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(fittedTicks([400])).toEqual([0, 100, 200, 300, 400]);
  });

  it('runs from the smallest value to zero when every value is negative', () => {
    expect(fittedTicks([-300, -1200, -700])).toEqual([-1500, -1000, -500, 0]);
  });

  it('keeps zero a tick when the values straddle it', () => {
    expect(fittedTicks([-90_000_000, 10_000_000, 100_000_000])).toEqual([
      -100_000_000, -50_000_000, 0, 50_000_000, 100_000_000,
    ]);
    expect(fittedTicks([-90_000_000, 10_000_000])).toEqual([
      -100_000_000, -75_000_000, -50_000_000, -25_000_000, 0, 25_000_000,
    ]);
  });

  it('steps by whole numbers at least', () => {
    expect(fittedTicks([3])).toEqual([0, 1, 2, 3]);
    expect(fittedTicks([-0.4, 2.2])).toEqual([-1, 0, 1, 2, 3]);
  });

  it('is zero and one with no values or only zeros, so the axis is never a single point', () => {
    expect(fittedTicks([])).toEqual([0, 1]);
    expect(fittedTicks([0, 0])).toEqual([0, 1]);
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
