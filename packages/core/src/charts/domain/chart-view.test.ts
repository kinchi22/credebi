import { describe, expect, it } from 'vitest';
import { isErr, ok } from '@repo/contracts';
import { defaultChartView, makeChartView } from './chart-view';

const TREND = 'assets-and-liabilities-trend';

describe('defaultChartView', () => {
  it("shows every line of the trend to a User who never chose, Net worth first", () => {
    expect(defaultChartView(TREND)).toEqual({
      shownSeriesIds: ['net-worth', 'total-assets', 'total-liabilities'],
    });
  });
});

describe('makeChartView', () => {
  it('keeps the chosen series', () => {
    expect(makeChartView(TREND, ['net-worth', 'total-assets'])).toEqual(
      ok({ shownSeriesIds: ['net-worth', 'total-assets'] }),
    );
  });

  it("orders the chosen series as the chart draws them, whatever order they were given in", () => {
    expect(makeChartView(TREND, ['total-liabilities', 'net-worth'])).toEqual(
      ok({ shownSeriesIds: ['net-worth', 'total-liabilities'] }),
    );
  });

  it('keeps a view that shows no series at all', () => {
    expect(makeChartView(TREND, [])).toEqual(ok({ shownSeriesIds: [] }));
  });

  it('refuses a series the chart does not draw', () => {
    const made = makeChartView(TREND, ['net-worth', 'equity']);

    expect(isErr(made) && made.error.code).toBe('INVALID_INPUT');
  });

  it('refuses a series named twice', () => {
    const made = makeChartView(TREND, ['net-worth', 'net-worth']);

    expect(isErr(made) && made.error.code).toBe('INVALID_INPUT');
  });
});
