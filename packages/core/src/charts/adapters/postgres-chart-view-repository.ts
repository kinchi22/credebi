import { and, eq } from 'drizzle-orm';
import {
  domainError,
  err,
  ok,
  type ChartId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { databaseFailure } from '../../auth/adapters/database-failure';
import { type Logger } from '../../logging/ports/logger';
import { makeChartView, type ChartView } from '../domain/chart-view';
import { type ChartViewRepository } from '../ports/chart-view-repository';

export type PostgresChartViewRepository = ChartViewRepository & {
  close: () => Promise<void>;
};

export function createPostgresChartViewRepository(
  connectionString: string,
  logger: Logger,
): PostgresChartViewRepository {
  const { database, close } = createDatabase(connectionString);
  const table = schema.userChartViews;

  return {
    read: async (userId: UserId, chartId: ChartId): Promise<Result<ChartView | undefined, DomainError>> => {
      let rows: { readonly shownSeriesIds: string[] }[];
      try {
        rows = await database
          .select({ shownSeriesIds: table.shownSeriesIds })
          .from(table)
          .where(and(eq(table.userId, userId), eq(table.chartId, chartId)));
      } catch (error) {
        return databaseFailure(logger, 'charts.read_failed', error, 'The Chart view could not be read.');
      }

      const [row] = rows;
      if (row === undefined) {
        return ok(undefined);
      }

      const view = makeChartView(chartId, row.shownSeriesIds);
      if (!view.ok) {
        logger.error(
          { event: 'charts.stored_chart_view_invalid', userId, chartId },
          'A stored Chart view shows a series its chart does not draw, so it was not read.',
        );
        return err(
          domainError('DEPENDENCY_UNAVAILABLE', 'The stored Chart view shows a series its chart does not draw.'),
        );
      }
      return view;
    },

    save: async (userId: UserId, chartId: ChartId, view: ChartView): Promise<Result<void, DomainError>> => {
      const shownSeriesIds = [...view.shownSeriesIds];
      try {
        await database
          .insert(table)
          .values({ userId, chartId, shownSeriesIds })
          .onConflictDoUpdate({ target: [table.userId, table.chartId], set: { shownSeriesIds } });
        return ok(undefined);
      } catch (error) {
        return databaseFailure(logger, 'charts.save_failed', error, 'The Chart view could not be saved.');
      }
    },

    close,
  };
}
