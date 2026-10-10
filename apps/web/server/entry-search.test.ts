import { domainError, type PostedEntry, type SearchCriteriaInput } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { toTrpcError } from './domain-error';
import { answerDefaultRangeSearch, answerEntrySearch, type SearchForEntries } from './entry-search';

const CASH = '01920000-0000-7000-8000-00000000c001';
const EXPENSES = '01920000-0000-7000-8000-00000000c005';
const ANOTHER_USERS_CASH = '01920000-0000-7000-8000-00000000d001';

const ENTRY = {
  id: '01920000-0000-7000-8000-000000000001',
  entryDate: '2026-06-15',
  memo: 'Office supplies',
  lines: [
    { account: EXPENSES, accountName: 'Expenses', side: 'debit', amount: 12500 },
    { account: CASH, accountName: 'Cash', side: 'credit', amount: 12500 },
  ],
  total: 12500,
  createdAt: '2026-06-15T00:30:00.000Z',
} as PostedEntry;

const holding = (entries: readonly PostedEntry[]): SearchForEntries => () =>
  Promise.resolve(entries);

const refusing = (code: Parameters<typeof domainError>[0]): SearchForEntries => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

const inRange: SearchForEntries = (criteria: SearchCriteriaInput) =>
  Promise.resolve(
    criteria.from !== undefined && ENTRY.entryDate < criteria.from ? [] : [ENTRY],
  );

describe('answerEntrySearch', () => {
  it('answers with what the search found, under the criteria the query held', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { from: '2026-06-01', to: '2026-06-30' },
      entries: [ENTRY],
    });
  });

  it('reads a query with no parameters as a search for everything', async () => {
    const answer = await answerEntrySearch(inRange, {});

    expect(answer.outcome).toBe('answered');
    expect(answer.criteria.from).toBeUndefined();
  });

  it('searches with the criteria it read, so the range narrows what comes back', async () => {
    const answer = await answerEntrySearch(inRange, { from: '2026-07-01' });

    expect(answer).toEqual({ outcome: 'answered', criteria: { from: '2026-07-01' }, entries: [] });
  });

  it('reads the Account out of the query, and fills it back into the form', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { account: CASH });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { account: CASH },
      entries: [ENTRY],
    });
  });

  it('refuses an Account the procedure refuses, and carries the criterion back with it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), {
      account: ANOTHER_USERS_CASH,
    });

    expect(answer).toEqual({ outcome: 'refused', criteria: { account: ANOTHER_USERS_CASH } });
  });

  it('carries an Account that is no Account id back with the refusal of the procedure', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), { account: 'cash' });

    expect(answer).toEqual({ outcome: 'refused', criteria: { account: 'cash' } });
  });

  it('reads the memo term out of the query, and fills it back into the form as typed', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { memo: '  Supplies  ' });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { memo: '  Supplies  ' },
      entries: [ENTRY],
    });
  });

  it('refuses a memo term the procedure refuses, and carries the term back with it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), { memo: 'supplies' });

    expect(answer).toEqual({ outcome: 'refused', criteria: { memo: 'supplies' } });
  });

  it('refuses a malformed day, and fills no criterion back into the form', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { from: 'june' });

    expect(answer.outcome).toBe('refused');
    expect(answer.criteria).toEqual({});
  });

  it('refuses what the procedure refused, and keeps the criteria that produced it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), {
      from: '2026-06-30',
      to: '2026-06-01',
    });

    expect(answer).toEqual({
      outcome: 'refused',
      criteria: { from: '2026-06-30', to: '2026-06-01' },
    });
  });

  it('asks the procedure even when the query is malformed, so a missing Session still wins', async () => {
    const redirected = new Error('NEXT_REDIRECT');

    await expect(
      answerEntrySearch(() => Promise.reject(redirected), { from: 'june' }),
    ).rejects.toBe(redirected);
  });

  it('passes a failure that is not a refusal of the criteria through', async () => {
    await expect(
      answerEntrySearch(refusing('DEPENDENCY_UNAVAILABLE'), { from: '2026-06-01' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('passes anything that is not a refusal at all through', async () => {
    const defect = new Error('DATABASE_URL is not set.');

    await expect(answerEntrySearch(() => Promise.reject(defect), {})).rejects.toBe(defect);
  });
});

describe('answerDefaultRangeSearch', () => {
  it('searches the range it was given, and answers with what was found', async () => {
    const answer = await answerDefaultRangeSearch(inRange, { from: '2026-07-01', to: '2026-07-31' });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { from: '2026-07-01', to: '2026-07-31' },
      entries: [],
    });
  });

  it('searches nothing but the range, whatever else it was sent', async () => {
    const answer = await answerDefaultRangeSearch(holding([ENTRY]), {
      from: '2026-06-01',
      to: '2026-06-30',
      memo: 'Office',
    });

    expect(answer.criteria).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', '2026-06-01'],
    ['a range with no last day', { from: '2026-06-01' }],
    ['a range with no first day', { to: '2026-06-30' }],
    ['a range whose day is not a calendar day', { from: '2026-02-30', to: '2026-03-01' }],
  ])('refuses %s without searching', async (_name, range) => {
    let searched = false;
    const answer = await answerDefaultRangeSearch(() => {
      searched = true;
      return Promise.resolve([ENTRY]);
    }, range);

    expect(answer).toEqual({ outcome: 'refused', criteria: {} });
    expect(searched).toBe(false);
  });

  it('refuses a range that ends before it starts, as the search does', async () => {
    const answer = await answerDefaultRangeSearch(refusing('INVALID_INPUT'), {
      from: '2026-06-30',
      to: '2026-06-01',
    });

    expect(answer.outcome).toBe('refused');
  });
});
