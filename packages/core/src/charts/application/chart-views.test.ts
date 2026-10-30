import { describe, expect, it } from 'vitest';
import { domainError, err, ok, type UserId } from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type ChartViewRepository } from '../ports/chart-view-repository';
import { createChangeChartView, type ChangeChartView } from './change-chart-view';
import { createGetChartView, type GetChartView } from './get-chart-view';
import { inMemoryChartViews } from './in-memory-chart-views';

const TREND = 'assets-and-liabilities-trend';

const ALL_LINES = ['net-worth', 'total-assets', 'total-liabilities'];

const unavailableChartViews: ChartViewRepository = {
  read: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  save: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
};

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a2' as UserId };

function useCases(chartViews: ChartViewRepository): {
  getChartView: GetChartView;
  changeChartView: ChangeChartView;
} {
  return {
    getChartView: createGetChartView({ chartViews }),
    changeChartView: createChangeChartView({ chartViews }),
  };
}

describe('createGetChartView', () => {
  it('shows every line of the trend to a User with no Chart view for it', async () => {
    const { getChartView } = useCases(inMemoryChartViews());

    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: ALL_LINES }));
  });

  it('refuses to read a Chart view for nobody, as unauthenticated', async () => {
    const { getChartView } = useCases(inMemoryChartViews());

    const read = await getChartView(SIGNED_OUT, TREND);

    expect(!read.ok && read.error.code).toBe('UNAUTHENTICATED');
  });

  it('shows every line of the trend when the Chart view cannot be read, so it never takes the report down', async () => {
    const { getChartView } = useCases(unavailableChartViews);

    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: ALL_LINES }));
  });
});

describe('createChangeChartView', () => {
  it("keeps the shown series as the signed-in User's, leaving another User's at the default", async () => {
    const { getChartView, changeChartView } = useCases(inMemoryChartViews());

    expect(await changeChartView(ADA, TREND, ['net-worth', 'total-assets'])).toEqual(ok(undefined));

    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['net-worth', 'total-assets'] }));
    expect(await getChartView(GRACE, TREND)).toEqual(ok({ shownSeriesIds: ALL_LINES }));
  });

  it('keeps a choice that hides every line, and brings one back', async () => {
    const { getChartView, changeChartView } = useCases(inMemoryChartViews());

    await changeChartView(ADA, TREND, []);
    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: [] }));

    await changeChartView(ADA, TREND, ['total-liabilities']);
    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['total-liabilities'] }));
  });

  it('refuses a series the chart does not draw, and keeps the earlier choice', async () => {
    const chartViews = inMemoryChartViews();
    const { getChartView, changeChartView } = useCases(chartViews);
    await changeChartView(ADA, TREND, ['net-worth']);

    const changed = await changeChartView(ADA, TREND, ['net-worth', 'equity']);

    expect(!changed.ok && changed.error.code).toBe('INVALID_INPUT');
    expect(await getChartView(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['net-worth'] }));
  });

  it('refuses to change a Chart view for nobody, as unauthenticated, and stores nothing', async () => {
    const chartViews = inMemoryChartViews();
    const { changeChartView } = useCases(chartViews);

    const changed = await changeChartView(SIGNED_OUT, TREND, ['net-worth']);

    expect(!changed.ok && changed.error.code).toBe('UNAUTHENTICATED');
    expect(await chartViews.read(ADA_ID, TREND)).toEqual(ok(undefined));
  });

  it('reports a failed save as its own result', async () => {
    const { changeChartView } = useCases(unavailableChartViews);

    const changed = await changeChartView(ADA, TREND, ['net-worth']);

    expect(!changed.ok && changed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
