import { describe, expect, it } from 'vitest';
import { type AccountGroupId, type AccountId } from '@repo/contracts';
import {
  ACCOUNT_TYPES,
  accountNames,
  chartOutline,
  dayOf,
  startingChart,
  type Account,
  type AccountGroup,
  type ChartNode,
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
  groupId: null,
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

const groupIdOf = (n: number): AccountGroupId =>
  `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId;

const group = (n: number, accountType: AccountGroup['accountType'], position: number): AccountGroup => ({
  id: groupIdOf(n),
  accountType,
  name: `Group ${String(n)}`,
  description: null,
  position,
});

const inGroup = (grouped: Account, n: number): Account => ({ ...grouped, groupId: groupIdOf(n) });

const named = (node: ChartNode): string =>
  node.kind === 'account'
    ? node.account.id
    : `${node.group.id} [${node.accounts.map((grouped) => grouped.id).join(', ')}]`;

describe('chartOutline', () => {
  it('lists the Accounts by Account type, and by position within one', () => {
    const accounts = [
      account(1, 'expense', 0),
      account(2, 'asset', 2),
      account(3, 'revenue', 0),
      account(4, 'asset', 0),
      account(5, 'liability', 1),
      account(6, 'equity', 0),
      account(7, 'asset', 1),
      account(8, 'liability', 0),
    ];

    expect(chartOutline({ accounts, groups: [] }).map(named)).toEqual(
      [4, 7, 2, 8, 5, 6, 3, 1].map(idOf),
    );
  });

  it("places an Account type's Account groups among its ungrouped Accounts by position, each holding its own Accounts by position", () => {
    const bank = group(10, 'asset', 1);
    const cards = group(11, 'liability', 0);
    const savings = group(12, 'asset', 3);
    const accounts = [
      account(1, 'asset', 0),
      inGroup(account(2, 'asset', 1), 10),
      inGroup(account(3, 'asset', 0), 10),
      account(4, 'asset', 2),
      inGroup(account(5, 'liability', 0), 11),
      account(6, 'liability', 1),
    ];

    expect(chartOutline({ accounts, groups: [savings, cards, bank] })).toEqual([
      { kind: 'account', account: accounts[0] },
      { kind: 'group', group: bank, accounts: [accounts[2], accounts[1]] },
      { kind: 'account', account: accounts[3] },
      { kind: 'group', group: savings, accounts: [] },
      { kind: 'group', group: cards, accounts: [accounts[4]] },
      { kind: 'account', account: accounts[5] },
    ]);
  });

  it('keeps the order it was given between Accounts of one position', () => {
    const accounts = [account(2, 'asset', 0), account(1, 'asset', 0)];

    expect(chartOutline({ accounts, groups: [] }).map(named)).toEqual([idOf(2), idOf(1)]);
  });

  it('leaves the chart it was given as it was', () => {
    const accounts = [inGroup(account(1, 'asset', 1), 10), inGroup(account(2, 'asset', 0), 10)];
    const groups = [group(11, 'asset', 1), group(10, 'asset', 0)];

    chartOutline({ accounts, groups });

    expect(accounts.map((kept) => kept.id)).toEqual([idOf(1), idOf(2)]);
    expect(groups.map((kept) => kept.id)).toEqual([groupIdOf(11), groupIdOf(10)]);
  });

  it('outlines an empty chart as nothing', () => {
    expect(chartOutline({ accounts: [], groups: [] })).toEqual([]);
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
