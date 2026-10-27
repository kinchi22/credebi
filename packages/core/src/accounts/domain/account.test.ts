import { describe, expect, it } from 'vitest';
import { domainError, err, ok, type AccountGroupId, type AccountId } from '@repo/contracts';
import {
  ACCOUNT_TYPES,
  accountNames,
  chartInOrder,
  dayOf,
  parseDay,
  startingChart,
  type Account,
  type AccountGroup,
  type ChartNode,
  type StartingChartCopy,
  type StartingNodeCopy,
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

describe('parseDay', () => {
  it('takes a calendar day written as year, month and day', () => {
    expect(parseDay('2000-01-01')).toEqual(ok('2000-01-01'));
    expect(parseDay('2024-02-29')).toEqual(ok('2024-02-29'));
  });

  it.each([
    '',
    'tomorrow',
    '2026-9-1',
    '2026-09-01T00:00:00Z',
    ' 2026-09-01',
    '2026-13-01',
    '2026-02-30',
    '2025-02-29',
  ])('refuses %j as a day', (text) => {
    expect(parseDay(text)).toEqual(err(domainError('INVALID_INPUT', `"${text}" is not a day.`)));
  });
});

const STARTING_COPY: StartingChartCopy = {
  cashAndDeposits: { name: 'Cash and deposits', description: 'Cash and bank deposits together' },
  cash: { name: 'Cash', description: 'Cash in a wallet' },
  bankDeposits: { name: 'Bank deposits', description: 'Money in bank accounts' },
  creditCardPayable: { name: 'Credit card payable', description: 'Card spending not yet repaid' },
  openingBalanceEquity: { name: 'Opening balance equity', description: 'Net worth at the start' },
  salary: { name: 'Salary', description: 'Pay for work' },
  livingExpenses: { name: 'Living expenses', description: 'Everyday spending together' },
  food: { name: 'Food', description: 'Groceries and eating out' },
  transportation: { name: 'Transportation', description: 'Getting around' },
  otherLivingExpenses: { name: 'Other living expenses', description: 'Everything else' },
};

describe('startingChart', () => {
  let issued = 0;
  const ids = {
    newAccountId: (): AccountId => {
      issued += 1;
      return idOf(issued);
    },
    newAccountGroupId: (): AccountGroupId => {
      issued += 1;
      return groupIdOf(issued);
    },
  };

  it('starts a User with two Account groups and eight Accounts for personal living expenses, described as given, from the given day', () => {
    issued = 0;

    const chart = startingChart('2026-09-18', STARTING_COPY, ids);

    const starting = (
      n: number,
      accountType: Account['accountType'],
      group: number | null,
      position: number,
      { name, description }: StartingNodeCopy,
    ): Account => ({
      id: idOf(n),
      accountType,
      groupId: group === null ? null : groupIdOf(group),
      name,
      description,
      position,
      activeFrom: '2026-09-18',
      activeUntil: null,
    });
    expect(chart).toEqual({
      groups: [
        { id: groupIdOf(1), accountType: 'asset', position: 0, ...STARTING_COPY.cashAndDeposits },
        { id: groupIdOf(7), accountType: 'expense', position: 0, ...STARTING_COPY.livingExpenses },
      ],
      accounts: [
        starting(2, 'asset', 1, 0, STARTING_COPY.cash),
        starting(3, 'asset', 1, 1, STARTING_COPY.bankDeposits),
        starting(4, 'liability', null, 0, STARTING_COPY.creditCardPayable),
        starting(5, 'equity', null, 0, STARTING_COPY.openingBalanceEquity),
        starting(6, 'revenue', null, 0, STARTING_COPY.salary),
        starting(8, 'expense', 7, 0, STARTING_COPY.food),
        starting(9, 'expense', 7, 1, STARTING_COPY.transportation),
        starting(10, 'expense', 7, 2, STARTING_COPY.otherLivingExpenses),
      ],
    });
  });

  it('lays the starting chart out in Account type order, each group holding its Accounts in order', () => {
    issued = 0;

    const nodes = chartInOrder(startingChart('2026-09-18', STARTING_COPY, ids));

    expect(
      nodes.map((node) =>
        node.kind === 'account'
          ? node.account.name
          : [node.group.name, node.accounts.map(({ name }) => name)],
      ),
    ).toEqual([
      ['Cash and deposits', ['Cash', 'Bank deposits']],
      'Credit card payable',
      'Opening balance equity',
      'Salary',
      ['Living expenses', ['Food', 'Transportation', 'Other living expenses']],
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

describe('chartInOrder', () => {
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

    expect(chartInOrder({ accounts, groups: [] }).map(named)).toEqual(
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

    expect(chartInOrder({ accounts, groups: [savings, cards, bank] })).toEqual([
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

    expect(chartInOrder({ accounts, groups: [] }).map(named)).toEqual([idOf(2), idOf(1)]);
  });

  it('leaves the chart it was given as it was', () => {
    const accounts = [inGroup(account(1, 'asset', 1), 10), inGroup(account(2, 'asset', 0), 10)];
    const groups = [group(11, 'asset', 1), group(10, 'asset', 0)];

    chartInOrder({ accounts, groups });

    expect(accounts.map((kept) => kept.id)).toEqual([idOf(1), idOf(2)]);
    expect(groups.map((kept) => kept.id)).toEqual([groupIdOf(11), groupIdOf(10)]);
  });

  it('outlines an empty chart as nothing', () => {
    expect(chartInOrder({ accounts: [], groups: [] })).toEqual([]);
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
