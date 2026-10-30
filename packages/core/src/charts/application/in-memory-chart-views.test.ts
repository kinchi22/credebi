import { describe, expect, it } from 'vitest';
import { ok, type UserId } from '@repo/contracts';
import { inMemoryChartViews } from './in-memory-chart-views';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;
const TREND = 'assets-and-liabilities-trend';

describe('inMemoryChartViews', () => {
  it('reads no Chart view for a User who saved none', async () => {
    expect(await inMemoryChartViews().read(ADA, TREND)).toEqual(ok(undefined));
  });

  it('reads back the latest view a User saved, and none for another User', async () => {
    const chartViews = inMemoryChartViews();

    expect(await chartViews.save(ADA, TREND, { shownSeriesIds: ['net-worth'] })).toEqual(ok(undefined));
    await chartViews.save(ADA, TREND, { shownSeriesIds: ['total-assets'] });

    expect(await chartViews.read(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['total-assets'] }));
    expect(await chartViews.read(GRACE, TREND)).toEqual(ok(undefined));
  });

  it('keeps each instance apart', async () => {
    const first = inMemoryChartViews();
    await first.save(ADA, TREND, { shownSeriesIds: [] });

    expect(await inMemoryChartViews().read(ADA, TREND)).toEqual(ok(undefined));
  });
});
