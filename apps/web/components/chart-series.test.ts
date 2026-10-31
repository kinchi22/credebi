import { describe, expect, it } from 'vitest';
import { toggledSeries } from './chart-series';

const ALL = ['netWorth', 'totalAssets', 'totalLiabilities'] as const;

describe('toggledSeries', () => {
  it('hides a shown series and keeps the others', () => {
    expect(toggledSeries(ALL, ALL, 'totalAssets')).toEqual(['netWorth', 'totalLiabilities']);
  });

  it('shows a hidden series again in its place among all of them', () => {
    expect(toggledSeries(ALL, ['totalLiabilities'], 'netWorth')).toEqual(['netWorth', 'totalLiabilities']);
  });

  it('lets the last shown series be hidden, leaving none', () => {
    expect(toggledSeries(ALL, ['totalAssets'], 'totalAssets')).toEqual([]);
  });
});
