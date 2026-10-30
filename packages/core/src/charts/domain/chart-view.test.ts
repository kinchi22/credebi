import { describe, expect, it } from 'vitest';
import { isErr, ok } from '@repo/contracts';
import { defaultChartView, makeChartView } from './chart-view';

const TREND = 'assets-and-liabilities-trend';

describe('defaultChartView', () => {
  it("shows every line of the trend to a User who never chose, Net worth first", () => {
    expect(defaultChartView(TREND)).toEqual({
      shownSeriesIds: ['netWorth', 'totalAssets', 'totalLiabilities'],
    });
  });
});

describe('makeChartView', () => {
  it('keeps the chosen series', () => {
    expect(makeChartView(TREND, ['netWorth', 'totalAssets'])).toEqual(
      ok({ shownSeriesIds: ['netWorth', 'totalAssets'] }),
    );
  });

  it("orders the chosen series as the chart draws them, whatever order they were given in", () => {
    expect(makeChartView(TREND, ['totalLiabilities', 'netWorth'])).toEqual(
      ok({ shownSeriesIds: ['netWorth', 'totalLiabilities'] }),
    );
  });

  it('keeps a view that shows no series at all', () => {
    expect(makeChartView(TREND, [])).toEqual(ok({ shownSeriesIds: [] }));
  });

  it('refuses a series the chart does not draw', () => {
    const made = makeChartView(TREND, ['netWorth', 'equity']);

    expect(isErr(made) && made.error.code).toBe('INVALID_INPUT');
  });

  it('refuses a series named twice', () => {
    const made = makeChartView(TREND, ['netWorth', 'netWorth']);

    expect(isErr(made) && made.error.code).toBe('INVALID_INPUT');
  });
});
