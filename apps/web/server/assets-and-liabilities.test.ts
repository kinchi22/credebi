import {
  assetsAndLiabilitiesSchema,
  domainError,
  type AssetsAndLiabilitiesQuery,
} from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import {
  answerAssetsAndLiabilities,
  answerDefaultDayAssetsAndLiabilities,
  type ShowAssetsAndLiabilities,
} from './assets-and-liabilities';
import { toTrpcError } from './domain-error';

const JUNE_LAST = { date: '2026-06-30' };

const REPORT = assetsAndLiabilitiesSchema.parse({
  assets: {
    total: 7000,
    rows: [{ kind: 'account', account: '01920000-0000-7000-8000-00000000c001', name: 'Cash', total: 7000 }],
  },
  liabilities: { total: 0, rows: [] },
  netWorth: 7000,
});

const failing = (code: Parameters<typeof domainError>[0]): ShowAssetsAndLiabilities => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

describe('answerAssetsAndLiabilities', () => {
  it('answers with the report for the day the query held, and asks for that day', async () => {
    const asked: AssetsAndLiabilitiesQuery[] = [];

    const answer = await answerAssetsAndLiabilities((day) => {
      asked.push(day);
      return Promise.resolve(REPORT);
    }, { ...JUNE_LAST, other: 'ignored' });

    expect(answer).toEqual({ outcome: 'answered', day: JUNE_LAST, report: REPORT });
    expect(asked).toEqual([JUNE_LAST]);
  });

  it.each([
    ['no date', {}],
    ['an empty date', { date: '' }],
    ['an impossible date', { date: '2026-02-30' }],
    ['a malformed date', { date: '30-06-2026' }],
    ['a repeated date', { date: ['2026-06-30', '2026-07-31'] }],
  ])('refuses a query with %s, fills no day back into the form, and asks for nothing', async (_case, query) => {
    const asked: AssetsAndLiabilitiesQuery[] = [];

    const answer = await answerAssetsAndLiabilities((day) => {
      asked.push(day);
      return Promise.resolve(REPORT);
    }, query);

    expect(answer).toEqual({ outcome: 'refused', day: {} });
    expect(asked).toEqual([]);
  });

  it('refuses a day the procedure refuses, and keeps the day that produced it', async () => {
    const answer = await answerAssetsAndLiabilities(failing('INVALID_INPUT'), JUNE_LAST);

    expect(answer).toEqual({ outcome: 'refused', day: JUNE_LAST });
  });

  it('answers that the report is unavailable when a dependency is, keeping the day', async () => {
    const answer = await answerAssetsAndLiabilities(failing('DEPENDENCY_UNAVAILABLE'), JUNE_LAST);

    expect(answer).toEqual({ outcome: 'unavailable', day: JUNE_LAST });
  });

  it('lets any other failure through, a redirect to sign in included', async () => {
    const redirected = new Error('NEXT_REDIRECT');

    await expect(
      answerAssetsAndLiabilities(() => Promise.reject(redirected), JUNE_LAST),
    ).rejects.toBe(redirected);
    await expect(answerAssetsAndLiabilities(failing('NOT_FOUND'), JUNE_LAST)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('answerDefaultDayAssetsAndLiabilities', () => {
  it('answers with the report for the day it was sent, and asks for nothing but that day', async () => {
    const asked: AssetsAndLiabilitiesQuery[] = [];

    const answer = await answerDefaultDayAssetsAndLiabilities((day) => {
      asked.push(day);
      return Promise.resolve(REPORT);
    }, { ...JUNE_LAST, memo: 'Office' });

    expect(answer).toEqual({ outcome: 'answered', day: JUNE_LAST, report: REPORT });
    expect(asked).toEqual([JUNE_LAST]);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a bare day', '2026-06-30'],
    ['a day held under no date', {}],
    ['an empty date', { date: '' }],
    ['a repeated date', { date: ['2026-06-30', '2026-07-31'] }],
    ['a date that is not a calendar day', { date: '2026-02-30' }],
  ])('refuses %s without asking for a report', async (_case, day) => {
    const asked: AssetsAndLiabilitiesQuery[] = [];

    const answer = await answerDefaultDayAssetsAndLiabilities((sent) => {
      asked.push(sent);
      return Promise.resolve(REPORT);
    }, day);

    expect(answer).toEqual({ outcome: 'refused', day: {} });
    expect(asked).toEqual([]);
  });

  it('answers as the report does when the procedure refuses or is unavailable', async () => {
    await expect(
      answerDefaultDayAssetsAndLiabilities(failing('INVALID_INPUT'), JUNE_LAST),
    ).resolves.toEqual({ outcome: 'refused', day: JUNE_LAST });
    await expect(
      answerDefaultDayAssetsAndLiabilities(failing('DEPENDENCY_UNAVAILABLE'), JUNE_LAST),
    ).resolves.toEqual({ outcome: 'unavailable', day: JUNE_LAST });
  });
});
