import { describe, expect, it } from 'vitest';
import {
  ASSETS_AND_LIABILITIES_TREND_CHART,
  changeChartViewInputSchema,
  chartIdSchema,
  chartViewInputSchema,
  chartViewSchema,
  toChartView,
  trendSeriesSchema,
} from './charts';

describe('chartIdSchema', () => {
  it('names the Assets and liabilities trend', () => {
    expect(chartIdSchema.options).toEqual(['assets-and-liabilities-trend']);
    expect(ASSETS_AND_LIABILITIES_TREND_CHART).toBe('assets-and-liabilities-trend');
  });

  it('rejects a chart the app does not draw', () => {
    expect(chartIdSchema.safeParse('income-statement-trend').success).toBe(false);
  });
});

describe('trendSeriesSchema', () => {
  it("holds the trend's three lines, Net worth first", () => {
    expect(trendSeriesSchema.options).toEqual(['netWorth', 'totalAssets', 'totalLiabilities']);
  });
});

describe('chartViewInputSchema', () => {
  it('takes the chart whose Chart view is read', () => {
    expect(chartViewInputSchema.parse({ chartId: 'assets-and-liabilities-trend' })).toEqual({
      chartId: 'assets-and-liabilities-trend',
    });
  });

  it('refuses no chart, or one the app does not draw', () => {
    expect(chartViewInputSchema.safeParse({}).success).toBe(false);
    expect(chartViewInputSchema.safeParse({ chartId: 'pie' }).success).toBe(false);
  });
});

describe('changeChartViewInputSchema', () => {
  it('takes the chart and the series to show, none included', () => {
    expect(
      changeChartViewInputSchema.parse({
        chartId: 'assets-and-liabilities-trend',
        shownSeriesIds: ['netWorth'],
      }),
    ).toEqual({ chartId: 'assets-and-liabilities-trend', shownSeriesIds: ['netWorth'] });
    expect(
      changeChartViewInputSchema.parse({ chartId: 'assets-and-liabilities-trend', shownSeriesIds: [] }),
    ).toEqual({ chartId: 'assets-and-liabilities-trend', shownSeriesIds: [] });
  });

  it('refuses a change with no series list, a series that is not text, or no chart', () => {
    expect(changeChartViewInputSchema.safeParse({ chartId: 'assets-and-liabilities-trend' }).success).toBe(
      false,
    );
    expect(
      changeChartViewInputSchema.safeParse({ chartId: 'assets-and-liabilities-trend', shownSeriesIds: [1] })
        .success,
    ).toBe(false);
    expect(changeChartViewInputSchema.safeParse({ shownSeriesIds: [] }).success).toBe(false);
  });
});

describe('chartViewSchema', () => {
  it('refuses a Chart view with no shown series list', () => {
    expect(chartViewSchema.safeParse({}).success).toBe(false);
  });
});

describe('toChartView', () => {
  it('carries the shown series alone, in a shape the schema accepts', () => {
    const view = toChartView({ shownSeriesIds: ['totalAssets'], extra: 'dropped' } as {
      readonly shownSeriesIds: readonly string[];
    });

    expect(view).toStrictEqual({ shownSeriesIds: ['totalAssets'] });
    expect(chartViewSchema.parse(view)).toEqual(view);
  });
});
