import { describe, expect, it } from 'vitest';
import { isErr, isOk, type Side } from '@repo/contracts';
import { draftTotals, type DraftLine } from './draft-totals';

const line = (side: Side, amount: string): DraftLine => ({ side, amount });

type Expected = {
  readonly debit: number;
  readonly credit: number;
  readonly difference: number;
};

const expectTotals = (lines: readonly DraftLine[], expected: Expected): void => {
  const result = draftTotals(lines);

  expect(isOk(result)).toBe(true);
  if (!isOk(result)) return;
  expect(result.value).toEqual(expected);
};

const expectOverflow = (lines: readonly DraftLine[], reason: string): void => {
  const result = draftTotals(lines);

  expect(isErr(result)).toBe(true);
  if (!isErr(result)) return;
  expect(result.error.code).toBe('INVALID_INPUT');
  expect(result.error.message).toContain(reason);
};



const LARGEST = String(Number.MAX_SAFE_INTEGER);

describe('draftTotals', () => {
  it('totals a balanced draft with no difference', () => {
    expectTotals(
      [line('debit', '12500'), line('credit', '5000'), line('credit', '7500')],
      { debit: 12500, credit: 12500, difference: 0 },
    );
  });

  it('totals an unbalanced draft rather than refusing it, the difference being debits less credits', () => {
    expectTotals([line('debit', '12500'), line('credit', '12000')], {
      debit: 12500,
      credit: 12000,
      difference: 500,
    });
    expectTotals([line('debit', '12000'), line('credit', '12500')], {
      debit: 12000,
      credit: 12500,
      difference: -500,
    });
  });

  it('totals a draft of one side only', () => {
    expectTotals([line('debit', '300'), line('debit', '200')], {
      debit: 500,
      credit: 0,
      difference: 500,
    });
  });

  it('totals nothing to zero', () => {
    expectTotals([], { debit: 0, credit: 0, difference: 0 });
  });

  it('counts nothing for an empty line', () => {
    expectTotals([line('debit', ''), line('credit', '')], { debit: 0, credit: 0, difference: 0 });
    expectTotals([line('debit', '12500'), line('credit', '')], {
      debit: 12500,
      credit: 0,
      difference: 12500,
    });
  });

  it.each([
    ['grouped', '12,500'],
    ['decimal', '125.'],
    ['signed', '-'],
    ['led by something else', 'x125'],
    ['trailed by something else', '125x'],
    ['spaced', ' 125'],
  ])('counts nothing for a half-typed amount that is %s', (_, amount) => {
    expectTotals([line('debit', amount), line('credit', '500')], {
      debit: 0,
      credit: 500,
      difference: -500,
    });
  });

  it('reads leading zeros as the number they spell, as the form parse does', () => {
    expectTotals([line('debit', '0125'), line('credit', '125')], {
      debit: 125,
      credit: 125,
      difference: 0,
    });
  });

  it('totals the largest amount there is', () => {
    expectTotals([line('debit', LARGEST), line('credit', LARGEST)], {
      debit: Number.MAX_SAFE_INTEGER,
      credit: Number.MAX_SAFE_INTEGER,
      difference: 0,
    });
  });

  it('is an error, not an approximation, when one amount is past what an amount can hold', () => {
    expectOverflow([line('debit', '9007199254740992'), line('credit', '1')], 'A line has more');
    expectOverflow([line('debit', '1'), line('credit', '9007199254740992')], 'A line has more');
  });

  it('is an error, not an approximation, when a side adds up to more than an amount can hold', () => {
    expectOverflow([line('debit', LARGEST), line('debit', '1'), line('credit', '1')], 'The debits add up');
    expectOverflow([line('debit', '1'), line('credit', LARGEST), line('credit', '1')], 'The credits add up');
  });
});
