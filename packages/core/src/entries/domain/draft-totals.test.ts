import { describe, expect, it } from 'vitest';
import { isErr, isOk, type Side } from '@repo/contracts';
import { differenceFill, draftTotals, type DraftLine } from './draft-totals';

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

type NamedDraftLine = DraftLine & { readonly name: string };

const named = (name: string, side: Side, amount: string): NamedDraftLine => ({ name, side, amount });

const expectFill = (lines: readonly NamedDraftLine[], name: string, amount: number): void => {
  expect(differenceFill(lines)).toEqual({
    line: lines.find((candidate) => candidate.name === name),
    amount,
  });
};

const expectNoFill = (lines: readonly NamedDraftLine[]): void => {
  expect(differenceFill(lines)).toBeUndefined();
};

describe('differenceFill', () => {
  it('fills the one empty credit with the size of the Difference when the credits fall short', () => {
    expectFill(
      [named('food', 'debit', '500'), named('transport', 'debit', '1000'), named('cash', 'credit', '')],
      'cash',
      1500,
    );
  });

  it('fills the one empty debit with the size of the Difference when the debits fall short', () => {
    expectFill(
      [named('food', 'debit', '700'), named('transport', 'debit', ''), named('cash', 'credit', '2000')],
      'transport',
      1300,
    );
  });

  it('fills only what the short Side still lacks when it already holds an amount', () => {
    expectFill(
      [
        named('food', 'debit', '1500'),
        named('cash', 'credit', '1000'),
        named('card', 'credit', ''),
      ],
      'card',
      500,
    );
  });

  it('offers no fill at a Difference of 0, with or without an empty line', () => {
    expectNoFill([]);
    expectNoFill([named('food', 'debit', '1500'), named('cash', 'credit', '1500')]);
    expectNoFill([
      named('food', 'debit', '1500'),
      named('cash', 'credit', '1500'),
      named('card', 'credit', ''),
    ]);
    expectNoFill([named('food', 'debit', ''), named('cash', 'credit', '')]);
  });

  it('offers no fill while the short Side has no empty line', () => {
    expectNoFill([named('food', 'debit', '1500'), named('cash', 'credit', '1000')]);
    expectNoFill([named('food', 'debit', '1000'), named('cash', 'credit', '1500')]);
  });

  it('offers no fill while the only empty lines are on the Side with the larger total', () => {
    expectNoFill([
      named('food', 'debit', '1500'),
      named('transport', 'debit', ''),
      named('cash', 'credit', '1000'),
    ]);
    expectNoFill([
      named('food', 'debit', '1000'),
      named('cash', 'credit', '1500'),
      named('card', 'credit', ''),
    ]);
  });

  it('fills the short Side\'s empty line though the larger Side has one too', () => {
    expectFill(
      [
        named('food', 'debit', '1500'),
        named('transport', 'debit', ''),
        named('cash', 'credit', '1000'),
        named('card', 'credit', ''),
      ],
      'card',
      500,
    );
  });

  it('offers no fill while the short Side has two empty lines', () => {
    expectNoFill([named('food', 'debit', '1500'), named('cash', 'credit', ''), named('card', 'credit', '')]);
    expectNoFill([named('food', 'debit', ''), named('transport', 'debit', ' '), named('cash', 'credit', '1500')]);
  });

  it('counts a spaces-only amount as empty and fills it', () => {
    expectFill([named('food', 'debit', '1500'), named('cash', 'credit', '   ')], 'cash', 1500);
  });

  it.each([
    ['grouped', '1,5oo'],
    ['spaced', ' 15'],
    ['signed', '-'],
  ])('neither fills nor counts as empty an amount that is %s', (_, amount) => {
    expectNoFill([named('food', 'debit', '1500'), named('cash', 'credit', amount)]);
    expectFill(
      [named('food', 'debit', '1500'), named('cash', 'credit', amount), named('card', 'credit', '')],
      'card',
      1500,
    );
  });

  it('fills the largest amount there is', () => {
    expectFill([named('food', 'debit', LARGEST), named('cash', 'credit', '')], 'cash', Number.MAX_SAFE_INTEGER);
  });

  it('offers no fill while the amounts add up to more than an amount can hold', () => {
    expectNoFill([named('food', 'debit', LARGEST), named('transport', 'debit', '1'), named('cash', 'credit', '')]);
    expectNoFill([named('food', 'debit', '9007199254740992'), named('cash', 'credit', '')]);
  });
});
