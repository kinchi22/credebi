import { describe, expect, it } from 'vitest';
import { type AccountId } from '@repo/contracts';
import {
  ACCOUNT_TYPES,
  accountNames,
  chartInOrder,
  dayOf,
  startingChart,
  type Account,
} from './account';

const idOf = (n: number): AccountId =>
  `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId;

const account = (
  n: number,
  accountType: Account['accountType'],
  position: number,
  name = `Account ${String(n)}`,
): Account => ({
  id: idOf(n),
  accountType,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

describe('ACCOUNT_TYPES', () => {
  it('lists the five Account types in the order of a chart of accounts', () => {
    expect(ACCOUNT_TYPES).toEqual(['asset', 'liability', 'equity', 'revenue', 'expense']);
  });
});

describe('dayOf', () => {
  it('takes the UTC calendar day of an instant', () => {
    expect(dayOf(new Date('2026-09-18T23:59:59.999Z'))).toBe('2026-09-18');
    expect(dayOf(new Date('2026-09-19T08:30:00+09:00'))).toBe('2026-09-18');
  });
});

describe('startingChart', () => {
  it('starts a User with Cash, Accounts payable, Capital, Sales and Expenses, one under each Account type, from the given day', () => {
    let issued = 0;
    const chart = startingChart('2026-09-18', () => {
      issued += 1;
      return idOf(issued);
    });

    expect(chart).toEqual([
      { ...account(1, 'asset', 0, 'Cash'), activeFrom: '2026-09-18' },
      { ...account(2, 'liability', 0, 'Accounts payable'), activeFrom: '2026-09-18' },
      { ...account(3, 'equity', 0, 'Capital'), activeFrom: '2026-09-18' },
      { ...account(4, 'revenue', 0, 'Sales'), activeFrom: '2026-09-18' },
      { ...account(5, 'expense', 0, 'Expenses'), activeFrom: '2026-09-18' },
    ]);
  });
});

describe('chartInOrder', () => {
  it('lists the Accounts by Account type, and by position within one', () => {
    const chart = [
      account(1, 'expense', 0),
      account(2, 'asset', 2),
      account(3, 'revenue', 0),
      account(4, 'asset', 0),
      account(5, 'liability', 1),
      account(6, 'equity', 0),
      account(7, 'asset', 1),
      account(8, 'liability', 0),
    ];

    expect(chartInOrder(chart).map((ordered) => ordered.id)).toEqual(
      [4, 7, 2, 8, 5, 6, 3, 1].map(idOf),
    );
  });

  it('keeps the order it was given between Accounts of one position', () => {
    const chart = [account(2, 'asset', 0), account(1, 'asset', 0)];

    expect(chartInOrder(chart)).toEqual(chart);
  });

  it('leaves the chart it was given as it was', () => {
    const chart = [account(1, 'expense', 0), account(2, 'asset', 0)];

    chartInOrder(chart);

    expect(chart.map((kept) => kept.id)).toEqual([idOf(1), idOf(2)]);
  });
});

describe('accountNames', () => {
  it('names each Account of the chart by its id, and nothing else', () => {
    const names = accountNames([account(1, 'asset', 0, 'Cash'), account(2, 'expense', 0, 'Rent')]);

    expect([...names]).toEqual([
      [idOf(1), { id: idOf(1), name: 'Cash' }],
      [idOf(2), { id: idOf(2), name: 'Rent' }],
    ]);
  });
});
