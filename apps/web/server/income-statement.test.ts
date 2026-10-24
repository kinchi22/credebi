import { domainError, incomeStatementSchema, type IncomeStatementQuery } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { toTrpcError } from './domain-error';
import {
  answerDefaultRangeStatement,
  answerIncomeStatement,
  type ShowIncomeStatement,
} from './income-statement';

const JUNE = { from: '2026-06-01', to: '2026-06-30' };

const STATEMENT = incomeStatementSchema.parse({
  revenue: {
    total: 9500,
    rows: [{ kind: 'account', account: '01920000-0000-7000-8000-00000000c004', name: 'Sales', total: 9500 }],
  },
  expense: { total: 0, rows: [] },
  netIncome: 9500,
});

const failing = (code: Parameters<typeof domainError>[0]): ShowIncomeStatement => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

describe('answerIncomeStatement', () => {
  it('answers with the statement for the period the query held, and asks for that period', async () => {
    const asked: IncomeStatementQuery[] = [];

    const answer = await answerIncomeStatement((period) => {
      asked.push(period);
      return Promise.resolve(STATEMENT);
    }, { ...JUNE, other: 'ignored' });

    expect(answer).toEqual({ outcome: 'answered', period: JUNE, statement: STATEMENT });
    expect(asked).toEqual([JUNE]);
  });

  it.each([
    ['no To', { from: '2026-06-01' }],
    ['a malformed day', { from: 'june', to: '2026-06-30' }],
  ])('refuses a query with %s, fills no period back into the form, and asks for nothing', async (_case, query) => {
    const asked: IncomeStatementQuery[] = [];

    const answer = await answerIncomeStatement((period) => {
      asked.push(period);
      return Promise.resolve(STATEMENT);
    }, query);

    expect(answer).toEqual({ outcome: 'refused', period: {} });
    expect(asked).toEqual([]);
  });

  it('refuses a period the procedure refuses, and keeps the period that produced it', async () => {
    const reversed = { from: '2026-06-30', to: '2026-06-01' };

    const answer = await answerIncomeStatement(failing('INVALID_INPUT'), reversed);

    expect(answer).toEqual({ outcome: 'refused', period: reversed });
  });

  it('answers that the statement is unavailable when a dependency is, keeping the period', async () => {
    const answer = await answerIncomeStatement(failing('DEPENDENCY_UNAVAILABLE'), JUNE);

    expect(answer).toEqual({ outcome: 'unavailable', period: JUNE });
  });

  it('lets any other failure through, a redirect to sign in included', async () => {
    const redirected = new Error('NEXT_REDIRECT');

    await expect(answerIncomeStatement(() => Promise.reject(redirected), JUNE)).rejects.toBe(
      redirected,
    );
    await expect(answerIncomeStatement(failing('NOT_FOUND'), JUNE)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('answerDefaultRangeStatement', () => {
  it('answers with the statement for the range it was sent, and asks for nothing but that range', async () => {
    const asked: IncomeStatementQuery[] = [];

    const answer = await answerDefaultRangeStatement((period) => {
      asked.push(period);
      return Promise.resolve(STATEMENT);
    }, { ...JUNE, memo: 'Office' });

    expect(answer).toEqual({ outcome: 'answered', period: JUNE, statement: STATEMENT });
    expect(asked).toEqual([JUNE]);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', '2026-06-01'],
    ['a range with no last day', { from: '2026-06-01' }],
    ['a range with no first day', { to: '2026-06-30' }],
    ['a range with days that are not strings', { from: ['2026-06-01'], to: 20260630 }],
    ['a range whose day is not a calendar day', { from: '2026-02-30', to: '2026-03-01' }],
  ])('refuses %s without asking for a statement', async (_case, range) => {
    const asked: IncomeStatementQuery[] = [];

    const answer = await answerDefaultRangeStatement((period) => {
      asked.push(period);
      return Promise.resolve(STATEMENT);
    }, range);

    expect(answer).toEqual({ outcome: 'refused', period: {} });
    expect(asked).toEqual([]);
  });

  it('answers as the statement does when the procedure refuses or is unavailable', async () => {
    const reversed = { from: '2026-06-30', to: '2026-06-01' };

    await expect(answerDefaultRangeStatement(failing('INVALID_INPUT'), reversed)).resolves.toEqual({
      outcome: 'refused',
      period: reversed,
    });
    await expect(
      answerDefaultRangeStatement(failing('DEPENDENCY_UNAVAILABLE'), JUNE),
    ).resolves.toEqual({ outcome: 'unavailable', period: JUNE });
  });
});
