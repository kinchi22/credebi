import {
  assetsAndLiabilitiesTrendSchema,
  domainError,
  type AssetsAndLiabilitiesTrendQuery,
} from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import {
  answerAssetsAndLiabilitiesTrend,
  answerDefaultTrendRange,
  type ShowAssetsAndLiabilitiesTrend,
} from './assets-and-liabilities-trend';
import { toTrpcError } from './domain-error';

const JUNE_TO_JULY = { from: '2026-06', to: '2026-07' };

const TREND = assetsAndLiabilitiesTrendSchema.parse({
  months: [
    { month: '2026-06', totalAssets: 1000, totalLiabilities: 0, netWorth: 1000 },
    { month: '2026-07', totalAssets: 3000, totalLiabilities: 500, netWorth: 2500 },
  ],
  recorded: true,
});

const failing = (code: Parameters<typeof domainError>[0]): ShowAssetsAndLiabilitiesTrend => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

describe('answerAssetsAndLiabilitiesTrend', () => {
  it('answers with the trend for the range the query held, and asks for that range', async () => {
    const asked: AssetsAndLiabilitiesTrendQuery[] = [];

    const answer = await answerAssetsAndLiabilitiesTrend((range) => {
      asked.push(range);
      return Promise.resolve(TREND);
    }, { ...JUNE_TO_JULY, other: 'ignored' });

    expect(answer).toEqual({ outcome: 'answered', range: JUNE_TO_JULY, trend: TREND });
    expect(asked).toEqual([JUNE_TO_JULY]);
  });

  it.each([
    ['no range', {}],
    ['only From', { from: '2026-06' }],
    ['only To', { to: '2026-06' }],
    ['an empty From', { from: '', to: '2026-06' }],
    ['a malformed To', { from: '2026-06', to: '2026-13' }],
    ['a calendar day', { from: '2026-06-01', to: '2026-06' }],
    ['a repeated From', { from: ['2026-06', '2026-07'], to: '2026-08' }],
  ])('refuses a query with %s, fills no range back into the form, and asks for nothing', async (_case, query) => {
    const asked: AssetsAndLiabilitiesTrendQuery[] = [];

    const answer = await answerAssetsAndLiabilitiesTrend((range) => {
      asked.push(range);
      return Promise.resolve(TREND);
    }, query);

    expect(answer).toEqual({ outcome: 'refused', range: {} });
    expect(asked).toEqual([]);
  });

  it('refuses a range the procedure refuses, and keeps the range that produced it', async () => {
    const reversed = { from: '2026-07', to: '2026-06' };

    const answer = await answerAssetsAndLiabilitiesTrend(failing('INVALID_INPUT'), reversed);

    expect(answer).toEqual({ outcome: 'refused', range: reversed });
  });

  it('answers that the trend is unavailable when a dependency is, keeping the range', async () => {
    const answer = await answerAssetsAndLiabilitiesTrend(failing('DEPENDENCY_UNAVAILABLE'), JUNE_TO_JULY);

    expect(answer).toEqual({ outcome: 'unavailable', range: JUNE_TO_JULY });
  });

  it('lets any other failure through, a redirect to sign in included', async () => {
    const redirected = new Error('NEXT_REDIRECT');

    await expect(
      answerAssetsAndLiabilitiesTrend(() => Promise.reject(redirected), JUNE_TO_JULY),
    ).rejects.toBe(redirected);
    await expect(answerAssetsAndLiabilitiesTrend(failing('NOT_FOUND'), JUNE_TO_JULY)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('answerDefaultTrendRange', () => {
  it('answers with the trend for the range it was sent, and asks for nothing but that range', async () => {
    const asked: AssetsAndLiabilitiesTrendQuery[] = [];

    const answer = await answerDefaultTrendRange((range) => {
      asked.push(range);
      return Promise.resolve(TREND);
    }, { ...JUNE_TO_JULY, other: 'ignored' });

    expect(answer).toEqual({ outcome: 'answered', range: JUNE_TO_JULY, trend: TREND });
    expect(asked).toEqual([JUNE_TO_JULY]);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', '2026-06'],
    ['a range with no To month', { from: '2026-06' }],
    ['a range with no From month', { to: '2026-06' }],
    ['a range with months that are not strings', { from: ['2026-06'], to: 202607 }],
    ['a range whose month is not a calendar month', { from: '2026-13', to: '2027-01' }],
    ['a range of calendar days', { from: '2026-06-01', to: '2026-07-31' }],
  ])('refuses %s without asking for a trend', async (_case, range) => {
    const asked: AssetsAndLiabilitiesTrendQuery[] = [];

    const answer = await answerDefaultTrendRange((sent) => {
      asked.push(sent);
      return Promise.resolve(TREND);
    }, range);

    expect(answer).toEqual({ outcome: 'refused', range: {} });
    expect(asked).toEqual([]);
  });

  it('answers as the trend does when the procedure refuses or is unavailable', async () => {
    const reversed = { from: '2026-07', to: '2026-06' };

    await expect(answerDefaultTrendRange(failing('INVALID_INPUT'), reversed)).resolves.toEqual({
      outcome: 'refused',
      range: reversed,
    });
    await expect(answerDefaultTrendRange(failing('DEPENDENCY_UNAVAILABLE'), JUNE_TO_JULY)).resolves.toEqual({
      outcome: 'unavailable',
      range: JUNE_TO_JULY,
    });
  });
});
