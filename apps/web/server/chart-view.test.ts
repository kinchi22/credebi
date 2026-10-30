import { describe, expect, it } from 'vitest';
import { domainError, type ChangeChartViewInput } from '@repo/contracts';
import { type LogFields, type Logger } from '@repo/core';
import { keepChartView, type ChangeChartView } from './chart-view';
import { toTrpcError } from './domain-error';

const TREND = 'assets-and-liabilities-trend';

function recording(): { readonly logger: Logger; readonly logged: LogFields[] } {
  const logged: LogFields[] = [];
  return {
    logged,
    logger: {
      error: (fields) => {
        logged.push(fields);
      },
    },
  };
}

function keeping(): { readonly change: ChangeChartView; readonly kept: ChangeChartViewInput[] } {
  const kept: ChangeChartViewInput[] = [];
  return {
    kept,
    change: (input) => {
      kept.push(input);
      return Promise.resolve();
    },
  };
}

const refusing =
  (code: Parameters<typeof domainError>[0]): ChangeChartView =>
  () =>
    Promise.reject(toTrpcError(domainError(code, 'Refused.')));

describe('keepChartView', () => {
  it('keeps the shown series for the chart, logging nothing', async () => {
    const { logger, logged } = recording();
    const { change, kept } = keeping();

    await keepChartView(change, logger, TREND, ['net-worth', 'total-assets']);

    expect(kept).toEqual([{ chartId: TREND, shownSeriesIds: ['net-worth', 'total-assets'] }]);
    expect(logged).toEqual([]);
  });

  it('logs a series list that is not one, and keeps nothing', async () => {
    const { logger, logged } = recording();
    const { change, kept } = keeping();

    await keepChartView(change, logger, TREND, 'net-worth');

    expect(kept).toEqual([]);
    expect(logged).toEqual([{ event: 'charts.change_refused', chartId: TREND, code: 'INVALID_INPUT' }]);
  });

  it.each(['INVALID_INPUT', 'UNAUTHENTICATED', 'DEPENDENCY_UNAVAILABLE'] as const)(
    'logs a change refused as %s rather than throwing',
    async (code) => {
      const { logger, logged } = recording();

      await keepChartView(refusing(code), logger, TREND, ['net-worth']);

      expect(logged).toEqual([{ event: 'charts.change_refused', chartId: TREND, code }]);
    },
  );
});
