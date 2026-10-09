import { describe, expect, it } from 'vitest';
import { isErr, isOk, type AccountId } from '@repo/contracts';
import { type AccountNames } from '../../accounts/domain/account';
import { MEMO_MAX_LENGTH } from './entry';
import { makeSearchCriteria, NO_CRITERIA, type SearchCriteriaDraft } from './search-criteria';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const SALES = '01920000-0000-7000-8000-00000000c004' as AccountId;
const PETTY_CASH = '01920000-0000-7000-8000-00000000c0ff' as AccountId;

const NAMES: AccountNames = new Map([
  [CASH, { id: CASH, name: 'Cash' }],
  [SALES, { id: SALES, name: 'Sales' }],
]);

const criteriaOf = (draft: SearchCriteriaDraft): ReturnType<typeof makeSearchCriteria> =>
  makeSearchCriteria(draft, NAMES);

describe('makeSearchCriteria', () => {
  it('narrows by nothing when it is given nothing', () => {
    const criteria = criteriaOf({});

    expect(isOk(criteria)).toBe(true);
    expect(isOk(criteria) && criteria.value).toEqual(NO_CRITERIA);
  });

  it('keeps a range whose first day is given alone', () => {
    const criteria = criteriaOf({ from: '2026-06-01' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01' });
  });

  it('keeps a range whose last day is given alone', () => {
    const criteria = criteriaOf({ to: '2026-06-30' });

    expect(isOk(criteria) && criteria.value).toEqual({ to: '2026-06-30' });
  });

  it('keeps both ends of a range that is the right way round', () => {
    const criteria = criteriaOf({ from: '2026-06-01', to: '2026-06-30' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('accepts a range that starts and ends on the same day', () => {
    const criteria = criteriaOf({ from: '2026-06-15', to: '2026-06-15' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-15', to: '2026-06-15' });
  });

  it('reads an absent end as no criterion rather than as a criterion of nothing', () => {
    const criteria = criteriaOf({ from: undefined, to: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it.each([
    ['by a day', '2026-06-02', '2026-06-01'],
    ['by a month', '2026-07-01', '2026-06-01'],
    ['by a year', '2027-01-01', '2026-01-01'],
  ])('refuses a range that ends before it starts, %s', (_case, from, to) => {
    const criteria = criteriaOf({ from, to });

    expect(isErr(criteria)).toBe(true);
    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it("keeps an Account that is in the User's chart of accounts", () => {
    const criteria = criteriaOf({ account: CASH });

    expect(isOk(criteria) && criteria.value).toEqual({ account: CASH });
  });

  it('keeps the Account beside a range, so the two narrow together', () => {
    const criteria = criteriaOf({ from: '2026-06-01', to: '2026-06-30', account: SALES });

    expect(isOk(criteria) && criteria.value).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      account: SALES,
    });
  });

  it('reads an absent Account as no criterion rather than as a criterion of nothing', () => {
    const criteria = criteriaOf({ account: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it("refuses an Account outside the User's chart of accounts, and says which", () => {
    const criteria = criteriaOf({ account: PETTY_CASH });

    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
    expect(isErr(criteria) && criteria.error.message).toContain(PETTY_CASH);
  });

  it.each([
    ['its name', 'Cash'],
    ['a code', 'cash'],
    ['nothing at all', ''],
  ])('refuses an Account named by anything but its id: %s', (_case, account) => {
    const criteria = criteriaOf({ account });

    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('refuses any Account against an empty chart', () => {
    const criteria = makeSearchCriteria({ account: CASH }, new Map());

    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('refuses an Account outside the chart even when the range is a good one', () => {
    const criteria = criteriaOf({ from: '2026-06-01', to: '2026-06-30', account: PETTY_CASH });

    expect(isErr(criteria) && criteria.error.message).toContain(PETTY_CASH);
  });

  it('says which way round the days it was given were', () => {
    const criteria = criteriaOf({ from: '2026-06-30', to: '2026-06-01' });

    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-30');
    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-01');
  });

  it('keeps a memo term to look for', () => {
    const criteria = criteriaOf({ memo: 'coffee' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee' });
  });

  it('keeps the memo term beside the range and the Account, so all three narrow together', () => {
    const criteria = criteriaOf({
      from: '2026-06-01',
      to: '2026-06-30',
      account: CASH,
      memo: 'rent',
    });

    expect(isOk(criteria) && criteria.value).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      account: CASH,
      memo: 'rent',
    });
  });

  it('trims a term, so the space either side of a typed word is not searched for', () => {
    const criteria = criteriaOf({ memo: '  coffee  ' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee' });
  });

  it('keeps the space inside a term, which is part of what was typed', () => {
    const criteria = criteriaOf({ memo: ' coffee beans ' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee beans' });
  });

  it('reads an absent memo term as no criterion rather than as a criterion of nothing', () => {
    const criteria = criteriaOf({ memo: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it.each([
    ['nothing at all', ''],
    ['a single space', ' '],
    ['several spaces', '     '],
    ['a tab and a newline', '\t\n'],
  ])('reads a term of only whitespace as no criterion: %s', (_case, memo) => {
    const criteria = criteriaOf({ memo });

    expect(isOk(criteria)).toBe(true);
    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it('drops a whitespace-only term without dropping the criteria beside it', () => {
    const criteria = criteriaOf({ from: '2026-06-01', account: CASH, memo: '  ' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01', account: CASH });
  });

  it('keeps a term as long as a memo can be, which is a term that can still match', () => {
    const memo = 'a'.repeat(MEMO_MAX_LENGTH);

    const criteria = criteriaOf({ memo });

    expect(isOk(criteria) && criteria.value).toEqual({ memo });
  });

  it('refuses a term longer than a memo can be, since nothing that long can match', () => {
    const criteria = criteriaOf({ memo: 'a'.repeat(MEMO_MAX_LENGTH + 1) });

    expect(isErr(criteria)).toBe(true);
    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('says how long a term may be when it refuses one', () => {
    const criteria = criteriaOf({ memo: 'a'.repeat(MEMO_MAX_LENGTH + 1) });

    expect(isErr(criteria) && criteria.error.message).toContain(String(MEMO_MAX_LENGTH));
  });

  it('measures a term the way a memo is measured, in code points', () => {
    const grinning = String.fromCodePoint(0x1f600);

    const criteria = criteriaOf({ memo: grinning.repeat(MEMO_MAX_LENGTH) });

    expect(isOk(criteria)).toBe(true);
    expect(isErr(criteriaOf({ memo: grinning.repeat(MEMO_MAX_LENGTH + 1) }))).toBe(true);
  });

  it('measures the term it kept, so trailing space cannot push one over the cap', () => {
    const criteria = criteriaOf({ memo: `${'a'.repeat(MEMO_MAX_LENGTH)}   ` });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'a'.repeat(MEMO_MAX_LENGTH) });
  });

  it('keeps a wildcard in a term, which is a character to look for like any other', () => {
    const criteria = criteriaOf({ memo: '100% off_hours' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: '100% off_hours' });
  });
});
