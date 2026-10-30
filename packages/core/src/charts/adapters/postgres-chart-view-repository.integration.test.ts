import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, ok, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { createPostgresChartViewRepository } from './postgres-chart-view-repository';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

const repository = createPostgresChartViewRepository(databaseUrl, logger);
const dead = createPostgresChartViewRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;
const TREND = 'assets-and-liabilities-trend';

beforeEach(async () => {
  await database.execute(sql`truncate table users, user_chart_views cascade`);
  for (const [id, email] of [
    [ADA, 'ada@example.com'],
    [GRACE, 'grace@example.com'],
  ]) {
    await database.execute(
      sql`insert into users (id, email, created_at) values (${id}, ${email}, now())`,
    );
  }
  logged.length = 0;
});

async function countRows(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from user_chart_views`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresChartViewRepository', () => {
  it('reads no Chart view for a User who never chose, and stores nothing', async () => {
    expect(await repository.read(ADA, TREND)).toEqual(ok(undefined));
    expect(await countRows()).toBe(0);
    expect(logged).toEqual([]);
  });

  it('reads back the shown series it saved', async () => {
    expect(await repository.save(ADA, TREND, { shownSeriesIds: ['net-worth', 'total-assets'] })).toEqual(
      ok(undefined),
    );

    expect(await repository.read(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['net-worth', 'total-assets'] }));
    expect(logged).toEqual([]);
  });

  it('reads back a view that shows no series at all', async () => {
    await repository.save(ADA, TREND, { shownSeriesIds: [] });

    expect(await repository.read(ADA, TREND)).toEqual(ok({ shownSeriesIds: [] }));
  });

  it('keeps one row for a User who saves twice, holding the later series', async () => {
    await repository.save(ADA, TREND, { shownSeriesIds: ['net-worth'] });
    await repository.save(ADA, TREND, { shownSeriesIds: ['total-assets', 'total-liabilities'] });

    expect(await repository.read(ADA, TREND)).toEqual(
      ok({ shownSeriesIds: ['total-assets', 'total-liabilities'] }),
    );
    expect(await countRows()).toBe(1);
  });

  it("leaves another User's Chart view untouched, and reads none for a User who saved none (ADR-0021)", async () => {
    await repository.save(GRACE, TREND, { shownSeriesIds: ['total-liabilities'] });
    await repository.save(ADA, TREND, { shownSeriesIds: ['net-worth'] });

    expect(await repository.read(GRACE, TREND)).toEqual(ok({ shownSeriesIds: ['total-liabilities'] }));
    expect(await repository.read(ADA, TREND)).toEqual(ok({ shownSeriesIds: ['net-worth'] }));

    await database.execute(sql`delete from user_chart_views where user_id = ${GRACE}`);
    expect(await repository.read(GRACE, TREND)).toEqual(ok(undefined));
  });

  it("reads only the asked chart's view, and saves beside another chart's without changing it", async () => {
    await database.execute(
      sql`insert into user_chart_views (user_id, chart_id, shown_series_ids) values (${ADA}, 'another-chart', ${sql`array['revenue']::text[]`})`,
    );

    expect(await repository.read(ADA, TREND)).toEqual(ok(undefined));

    await repository.save(ADA, TREND, { shownSeriesIds: ['net-worth'] });

    const other = await database.execute<{ shown: string[] }>(
      sql`select shown_series_ids as shown from user_chart_views where chart_id = 'another-chart'`,
    );
    expect(other.rows).toEqual([{ shown: ['revenue'] }]);
    expect(await countRows()).toBe(2);
  });

  it('reports a stored series the chart does not draw rather than answering with it', async () => {
    await database.execute(
      sql`insert into user_chart_views (user_id, chart_id, shown_series_ids) values (${ADA}, ${TREND}, ${sql`array['net-worth', 'equity']::text[]`})`,
    );

    const read = await repository.read(ADA, TREND);

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([{ event: 'charts.stored_chart_view_invalid', userId: ADA, chartId: TREND }]);
  });

  it('reports an unreachable database as a result on both paths, never by throwing', async () => {
    const read = await dead.read(ADA, TREND);
    const saved = await dead.save(ADA, TREND, { shownSeriesIds: ['net-worth'] });

    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(saved) && saved.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged).toEqual([
      {
        event: 'charts.read_failed',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
      {
        event: 'charts.save_failed',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
    ]);
  });
});
