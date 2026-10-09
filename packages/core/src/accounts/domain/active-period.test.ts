import { describe, expect, it } from 'vitest';
import { domainError, err, ok, type AccountId } from '@repo/contracts';
import { type Account } from './account';
import {
  changesActivePeriod,
  checkActiveOn,
  checkKeepsShownEntries,
  endedLast,
  hasEndedBy,
  isActiveOn,
} from './active-period';

const account = (n: number, name: string, activeFrom: string, activeUntil: string | null): Account => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId,
  accountType: 'asset',
  groupId: null,
  name,
  description: null,
  position: n,
  activeFrom,
  activeUntil,
});

const CASH = account(1, 'Cash', '2026-09-01', null);
const OLD_WALLET = account(2, 'Old wallet', '2026-08-01', '2026-08-31');
const SAVINGS = account(3, 'Savings', '2026-10-01', '2026-10-31');

describe('isActiveOn', () => {
  it('holds from the start day through the end day, both included', () => {
    expect(isActiveOn(OLD_WALLET, '2026-08-01')).toBe(true);
    expect(isActiveOn(OLD_WALLET, '2026-08-15')).toBe(true);
    expect(isActiveOn(OLD_WALLET, '2026-08-31')).toBe(true);
  });

  it('does not hold the day before the start day or the day after the end day', () => {
    expect(isActiveOn(OLD_WALLET, '2026-07-31')).toBe(false);
    expect(isActiveOn(OLD_WALLET, '2026-09-01')).toBe(false);
  });

  it('holds on every day from the start day when there is no end day', () => {
    expect(isActiveOn(CASH, '2026-09-01')).toBe(true);
    expect(isActiveOn(CASH, '9999-12-31')).toBe(true);
    expect(isActiveOn(CASH, '2026-08-31')).toBe(false);
  });

  it('holds on the one day of a period that starts and ends on it', () => {
    const oneDay = account(4, 'Float', '2026-09-15', '2026-09-15');
    expect(isActiveOn(oneDay, '2026-09-15')).toBe(true);
    expect(isActiveOn(oneDay, '2026-09-14')).toBe(false);
    expect(isActiveOn(oneDay, '2026-09-16')).toBe(false);
  });
});

describe('hasEndedBy', () => {
  it('is true only once the day is after the end day', () => {
    expect(hasEndedBy(OLD_WALLET, '2026-09-01')).toBe(true);
    expect(hasEndedBy(OLD_WALLET, '2026-08-31')).toBe(false);
  });

  it('is never true for an Account with no end day, nor for one not started yet', () => {
    expect(hasEndedBy(CASH, '9999-12-31')).toBe(false);
    expect(hasEndedBy(SAVINGS, '2026-09-15')).toBe(false);
  });
});

describe('endedLast', () => {
  it('moves the Accounts ended by the day after the rest, keeping the order within each', () => {
    const ended = account(5, 'Old purse', '2026-01-01', '2026-02-01');
    expect(endedLast([OLD_WALLET, CASH, ended, SAVINGS], '2026-09-15')).toEqual([
      CASH,
      SAVINGS,
      OLD_WALLET,
      ended,
    ]);
  });

  it('keeps an Account ending on the day among the rest', () => {
    expect(endedLast([OLD_WALLET, CASH], '2026-08-31')).toEqual([OLD_WALLET, CASH]);
  });
});

describe('checkActiveOn', () => {
  const chart = [CASH, OLD_WALLET, SAVINGS];

  it('accepts lines whose every Account is active on the day', () => {
    expect(checkActiveOn(chart, '2026-09-15', [CASH.id])).toEqual(ok(undefined));
    expect(checkActiveOn(chart, '2026-08-31', [OLD_WALLET.id])).toEqual(ok(undefined));
  });

  it('refuses with INVALID_INPUT, naming the Account, when one Account is not active on the day', () => {
    expect(checkActiveOn(chart, '2026-09-15', [CASH.id, SAVINGS.id])).toEqual(
      err(
        domainError(
          'INVALID_INPUT',
          'Account "Savings" is not active on 2026-09-15, outside its Active period.',
        ),
      ),
    );
    expect(checkActiveOn(chart, '2026-09-01', [OLD_WALLET.id, CASH.id])).toEqual(
      err(
        domainError(
          'INVALID_INPUT',
          'Account "Old wallet" is not active on 2026-09-01, outside its Active period.',
        ),
      ),
    );
  });

  it('judges only the Accounts the lines name', () => {
    expect(checkActiveOn(chart, '2026-10-15', [SAVINGS.id])).toEqual(ok(undefined));
  });
});

describe('changesActivePeriod', () => {
  const chart = { accounts: [CASH, OLD_WALLET], groups: [] };

  it('is false when only the name, description or place changes', () => {
    expect(
      changesActivePeriod(chart, { ...OLD_WALLET, name: 'Purse', description: 'Coins', position: 9 }),
    ).toBe(false);
  });

  it('is true when the start day or the end day changes', () => {
    expect(changesActivePeriod(chart, { ...OLD_WALLET, activeFrom: '2026-08-02' })).toBe(true);
    expect(changesActivePeriod(chart, { ...OLD_WALLET, activeUntil: '2026-08-30' })).toBe(true);
    expect(changesActivePeriod(chart, { ...CASH, activeUntil: '2026-12-31' })).toBe(true);
    expect(changesActivePeriod(chart, { ...OLD_WALLET, activeUntil: null })).toBe(true);
  });

  it('is true for an Account the chart does not hold', () => {
    expect(changesActivePeriod(chart, SAVINGS)).toBe(true);
  });
});

describe('checkKeepsShownEntries', () => {
  const refusal = err(
    domainError(
      'IN_USE',
      'An Entry names Account "Old wallet" on a day outside the new Active period, so the period was not changed.',
    ),
  );

  it('accepts any period when no shown Entry names the Account', () => {
    expect(checkKeepsShownEntries(OLD_WALLET, null)).toEqual(ok(undefined));
  });

  it('accepts a period that holds the first and the last day a shown Entry names the Account', () => {
    expect(
      checkKeepsShownEntries(OLD_WALLET, { first: '2026-08-01', last: '2026-08-31' }),
    ).toEqual(ok(undefined));
  });

  it('refuses with IN_USE a period starting after the first day a shown Entry names the Account', () => {
    expect(checkKeepsShownEntries(OLD_WALLET, { first: '2026-07-31', last: '2026-08-15' })).toEqual(
      refusal,
    );
  });

  it('refuses with IN_USE a period ending before the last day a shown Entry names the Account', () => {
    expect(checkKeepsShownEntries(OLD_WALLET, { first: '2026-08-15', last: '2026-09-01' })).toEqual(
      refusal,
    );
  });
});
