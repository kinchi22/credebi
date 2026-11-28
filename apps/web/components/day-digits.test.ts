import { describe, expect, it } from 'vitest';
import { DAY_DIGITS, digitsOf, digitsOfIsoDay, editedDigits, firstDigits, isDayDigits, isoOfDayDigits, digitsOfIsoMonth, isoOfMonthDigits } from './day-digits';

const typed = (previous: string, raw: string, caret = raw.length) =>
  editedDigits(previous, raw, caret, DAY_DIGITS, true);
const set = (previous: string, raw: string, caret = raw.length) =>
  editedDigits(previous, raw, caret, DAY_DIGITS, false);

describe('digitsOf', () => {
  it('keeps only the digits, in order', () => {
    expect(digitsOf('2a0-2/6.1 x1y2z5')).toBe('20261125');
    expect(digitsOf('')).toBe('');
  });
});

describe('firstDigits', () => {
  it('reduces a pasted value to its first digits up to the limit', () => {
    expect(firstDigits('2026-11-25 and 99', 8)).toBe('20261125');
    expect(firstDigits('2026/1', 8)).toBe('20261');
    expect(firstDigits('202611', 6)).toBe('202611');
    expect(firstDigits('2026119', 6)).toBe('202611');
  });
});

describe('editedDigits', () => {
  it('adds a typed digit and moves the caret past it', () => {
    expect(typed('2026', '20261')).toEqual({ digits: '20261', caret: 5 });
    expect(typed('2026', '20126', 3)).toEqual({ digits: '20126', caret: 3 });
  });

  it('ignores a typed non-digit and leaves the caret where it was', () => {
    expect(typed('2026', '2026x')).toEqual({ digits: '2026', caret: 4 });
    expect(typed('2026', '20x26', 3)).toEqual({ digits: '2026', caret: 2 });
  });

  it('ignores a digit typed beyond the limit and leaves the caret where it was', () => {
    expect(typed('20261125', '202611259')).toEqual({ digits: '20261125', caret: 8 });
    expect(typed('20261125', '202696115', 5)).toEqual({ digits: '20261125', caret: 4 });
  });

  it('keeps the caret in the middle after a deletion', () => {
    expect(typed('20261125', '2021125', 3)).toEqual({ digits: '2021125', caret: 3 });
  });

  it('reduces a value set at once to its first digits, with the caret at its end', () => {
    expect(set('', '2026-11-25 99')).toEqual({ digits: '20261125', caret: 8 });
  });

  it('counts no digits before a caret that has none behind it', () => {
    expect(typed('', 'x')).toEqual({ digits: '', caret: 0 });
    expect(set('2026', '2026-11-25 99', 0)).toEqual({ digits: '20261125', caret: 0 });
  });

  it('reduces a value that is as long as the field to its first digits', () => {
    expect(set('20261125', '20261125-')).toEqual({ digits: '20261125', caret: 8 });
    expect(set('2026112', '2026-11-259')).toEqual({ digits: '20261125', caret: 8 });
  });

  it('keeps the first digits of a nine-digit value set over a full field, though it is one digit longer', () => {
    expect(set('20261125', '202611259')).toEqual({ digits: '20261125', caret: 8 });
    expect(set('20261125', '199912319')).toEqual({ digits: '19991231', caret: 8 });
  });

  it('replaces a selection by what is typed over it, even when full', () => {
    expect(typed('20261125', '19991125', 4)).toEqual({ digits: '19991125', caret: 4 });
  });
});

describe('isDayDigits', () => {
  it('accepts a real day', () => {
    expect(isDayDigits('20261125')).toBe(true);
    expect(isDayDigits('20260131')).toBe(true);
    expect(isDayDigits('20260430')).toBe(true);
  });

  it('knows the length of every month', () => {
    expect(isDayDigits('20260431')).toBe(false);
    expect(isDayDigits('20260631')).toBe(false);
    expect(isDayDigits('20260931')).toBe(false);
    expect(isDayDigits('20261131')).toBe(false);
    expect(isDayDigits('20260132')).toBe(false);
    expect(isDayDigits('20260230')).toBe(false);
    expect(isDayDigits('20260228')).toBe(true);
  });

  it('knows the leap years', () => {
    expect(isDayDigits('20240229')).toBe(true);
    expect(isDayDigits('20000229')).toBe(true);
    expect(isDayDigits('20250229')).toBe(false);
    expect(isDayDigits('19000229')).toBe(false);
    expect(isDayDigits('21000229')).toBe(false);
  });

  it('accepts the first and last day there is and nothing beyond', () => {
    expect(isDayDigits('00010101')).toBe(true);
    expect(isDayDigits('99991231')).toBe(true);
    expect(isDayDigits('00000101')).toBe(false);
    expect(isDayDigits('20260100')).toBe(false);
    expect(isDayDigits('20260001')).toBe(false);
    expect(isDayDigits('20261301')).toBe(false);
    expect(isDayDigits('20261200')).toBe(false);
  });

  it('refuses anything that is not eight digits', () => {
    expect(isDayDigits('')).toBe(false);
    expect(isDayDigits('2026112')).toBe(false);
    expect(isDayDigits('202611255')).toBe(false);
    expect(isDayDigits('2026-1-5')).toBe(false);
  });
});

describe('isoOfDayDigits (year 0000)', () => {
  it('refuses year 0000 whatever follows', () => {
    expect(isoOfDayDigits('00000229')).toBeUndefined();
  });
});

describe('isoOfDayDigits', () => {
  it('writes a real day as an ISO day', () => {
    expect(isoOfDayDigits('20261125')).toBe('2026-11-25');
    expect(isoOfDayDigits('00010101')).toBe('0001-01-01');
  });

  it('writes nothing for anything else', () => {
    expect(isoOfDayDigits('20260230')).toBeUndefined();
    expect(isoOfDayDigits('2026')).toBeUndefined();
  });
});

describe('digitsOfIsoDay', () => {
  it('shows an ISO day as its eight digits', () => {
    expect(digitsOfIsoDay('2026-11-25')).toBe('20261125');
  });

  it('shows anything else by its first eight digits', () => {
    expect(digitsOfIsoDay('')).toBe('');
    expect(digitsOfIsoDay('2026-1-5')).toBe('202615');
  });
});

describe('isoOfMonthDigits', () => {
  it('reads six digits as the ISO month', () => {
    expect(isoOfMonthDigits('202611')).toBe('2026-11');
    expect(isoOfMonthDigits('000101')).toBe('0001-01');
    expect(isoOfMonthDigits('999912')).toBe('9999-12');
  });

  it('refuses an unpadded, partial, overlong or impossible month', () => {
    for (const digits of ['', '20269', '2026009', '202613', '202600', '000001', '2026-9', 'abcdef']) {
      expect(isoOfMonthDigits(digits)).toBeUndefined();
    }
  });

  it('turns an ISO month into its six digits', () => {
    expect(digitsOfIsoMonth('2026-09')).toBe('202609');
    expect(digitsOfIsoMonth('')).toBe('');
  });
});
