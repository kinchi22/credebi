import { describe, expect, it } from 'vitest';
import {
  accountGroupIdSchema,
  accountIdSchema,
  accountSchema,
  accountsIn,
  accountTypeSchema,
  addAccountGroupInputSchema,
  addAccountInputSchema,
  chartSchema,
  deleteAccountGroupInputSchema,
  deleteAccountInputSchema,
  editAccountGroupInputSchema,
  editAccountInputSchema,
  groupsIn,
  moveBefore,
  moveChartNodeInputSchema,
  movedInChart,
  nodesOfType,
  parseAccountForm,
  parseAccountGroupForm,
  toChart,
  type AccountGroupId,
  type AccountId,
  type ChartOutput,
} from './accounts';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const BANK = '01920000-0000-7000-8000-00000000b001' as AccountGroupId;

const CASH_ACCOUNT = {
  id: CASH,
  accountType: 'asset',
  groupId: null,
  name: 'Cash',
  description: null,
  activeFrom: '2026-09-01',
  activeUntil: null,
} as const;

describe('accountIdSchema', () => {
  it('accepts a uuid v7', () => {
    expect(accountIdSchema.parse(CASH)).toBe(CASH);
  });

  it('rejects anything that is not a uuid v7, such as an Account name', () => {
    expect(accountIdSchema.safeParse('cash').success).toBe(false);
    expect(accountIdSchema.safeParse('9b2f6d1e-3c4a-4f5b-8a6d-7e8f9a0b1c2d').success).toBe(false);
  });
});

describe('accountTypeSchema', () => {
  it('holds the five Account types, in the order of a chart of accounts', () => {
    expect(accountTypeSchema.options).toEqual([
      'asset',
      'liability',
      'equity',
      'revenue',
      'expense',
    ]);
  });
});

describe('accountSchema', () => {
  it('reads an Account with its Active period', () => {
    expect(accountSchema.parse(CASH_ACCOUNT)).toEqual(CASH_ACCOUNT);
    expect(
      accountSchema.parse({ ...CASH_ACCOUNT, description: 'Notes', activeUntil: '2026-12-31' }),
    ).toEqual({ ...CASH_ACCOUNT, description: 'Notes', activeUntil: '2026-12-31' });
  });

  it('reads an Account in an Account group', () => {
    expect(accountSchema.parse({ ...CASH_ACCOUNT, groupId: BANK })).toEqual({
      ...CASH_ACCOUNT,
      groupId: BANK,
    });
  });

  it('refuses an Account of no known Account type, or with a start that is not a day', () => {
    expect(accountSchema.safeParse({ ...CASH_ACCOUNT, accountType: 'cash' }).success).toBe(false);
    expect(
      accountSchema.safeParse({ ...CASH_ACCOUNT, activeFrom: '2026-09-01T00:00:00Z' }).success,
    ).toBe(false);
    expect(accountSchema.safeParse({ ...CASH_ACCOUNT, groupId: 'bank' }).success).toBe(false);
  });
});

describe('accountGroupIdSchema', () => {
  it('accepts a uuid v7 and nothing else', () => {
    expect(accountGroupIdSchema.parse(BANK)).toBe(BANK);
    expect(accountGroupIdSchema.safeParse('bank').success).toBe(false);
  });
});

const SALES_ACCOUNT = {
  ...CASH_ACCOUNT,
  id: '01920000-0000-7000-8000-00000000c004' as AccountId,
  accountType: 'revenue',
  name: 'Sales',
  description: 'Takings',
  activeUntil: '2026-12-31',
} as const;

const ABC_BANK = {
  ...CASH_ACCOUNT,
  id: '01920000-0000-7000-8000-00000000c002' as AccountId,
  groupId: BANK,
  name: 'ABC Bank',
} as const;

const BANK_GROUP = {
  id: BANK,
  accountType: 'asset',
  name: 'Bank',
  description: 'Accounts at a bank',
} as const;

describe('toChart', () => {
  it('keeps the outline in its order with the fields the wire carries, and drops the rest', () => {
    const stored = [
      { kind: 'account', account: { ...CASH_ACCOUNT, position: 0 } },
      {
        kind: 'group',
        group: { ...BANK_GROUP, position: 1 },
        accounts: [{ ...ABC_BANK, position: 0 }],
      },
      { kind: 'account', account: { ...SALES_ACCOUNT, position: 3 } },
    ] as const;

    const chart = toChart(stored);

    expect(chart).toEqual([
      { kind: 'account', account: CASH_ACCOUNT },
      { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK] },
      { kind: 'account', account: SALES_ACCOUNT },
    ]);
    expect(chartSchema.parse(chart)).toEqual(chart);
  });
});

describe('accountsIn', () => {
  it("lists the chart's Accounts in its order, those of an Account group in their place, and no Account group", () => {
    expect(
      accountsIn([
        { kind: 'account', account: CASH_ACCOUNT },
        { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK] },
        { kind: 'group', group: { ...BANK_GROUP, name: 'Empty' }, accounts: [] },
        { kind: 'account', account: SALES_ACCOUNT },
      ]),
    ).toEqual([CASH_ACCOUNT, ABC_BANK, SALES_ACCOUNT]);
  });
});

describe('groupsIn', () => {
  it("lists the chart's Account groups in its order, and no Account", () => {
    const empty = { ...BANK_GROUP, name: 'Empty' };

    expect(
      groupsIn([
        { kind: 'account', account: CASH_ACCOUNT },
        { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK] },
        { kind: 'group', group: empty, accounts: [] },
      ]),
    ).toEqual([BANK_GROUP, empty]);
  });
});

describe('nodesOfType', () => {
  it('keeps the Accounts and Account groups of one Account type, in their order', () => {
    const chart: ChartOutput = [
      { kind: 'account', account: CASH_ACCOUNT },
      { kind: 'account', account: SALES_ACCOUNT },
      { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK] },
      { kind: 'group', group: { ...BANK_GROUP, accountType: 'revenue' }, accounts: [] },
    ];

    expect(nodesOfType(chart, 'asset')).toEqual([chart[0], chart[2]]);
    expect(nodesOfType(chart, 'revenue')).toEqual([chart[1], chart[3]]);
    expect(nodesOfType(chart, 'expense')).toEqual([]);
  });
});

const WALLET_ACCOUNT = {
  ...CASH_ACCOUNT,
  id: '01920000-0000-7000-8000-00000000c005' as AccountId,
  name: 'Wallet',
} as const;

const XYZ_BANK = {
  ...ABC_BANK,
  id: '01920000-0000-7000-8000-00000000c006' as AccountId,
  name: 'XYZ Bank',
} as const;

const SAVINGS_GROUP = {
  ...BANK_GROUP,
  id: '01920000-0000-7000-8000-00000000b002' as AccountGroupId,
  name: 'Savings',
} as const;

const OUTLINE: ChartOutput = [
  { kind: 'account', account: CASH_ACCOUNT },
  { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK, XYZ_BANK] },
  { kind: 'account', account: WALLET_ACCOUNT },
  { kind: 'group', group: SAVINGS_GROUP, accounts: [] },
  { kind: 'account', account: SALES_ACCOUNT },
];

describe('moveBefore', () => {
  const asset = { accountType: 'asset', groupId: null } as const;
  const inBank = { accountType: 'asset', groupId: BANK } as const;

  it('places a node at the place of the node it goes before, counted among the others of the list', () => {
    expect(moveBefore(OUTLINE, { kind: 'account', id: WALLET_ACCOUNT.id }, asset, CASH)).toEqual({
      node: { kind: 'account', id: WALLET_ACCOUNT.id },
      ...asset,
      index: 0,
    });
    expect(
      moveBefore(OUTLINE, { kind: 'account', id: CASH }, asset, SAVINGS_GROUP.id).index,
    ).toBe(2);
  });

  it("places a node into an Account group's list, before one of its Accounts", () => {
    expect(moveBefore(OUTLINE, { kind: 'account', id: CASH }, inBank, XYZ_BANK.id)).toEqual({
      node: { kind: 'account', id: CASH },
      ...inBank,
      index: 1,
    });
  });

  it('places a node last when it goes before nothing, or before a node not in the list', () => {
    expect(moveBefore(OUTLINE, { kind: 'account', id: CASH }, asset, null).index).toBe(3);
    expect(moveBefore(OUTLINE, { kind: 'account', id: CASH }, inBank, null).index).toBe(2);
    expect(moveBefore(OUTLINE, { kind: 'account', id: WALLET_ACCOUNT.id }, inBank, CASH).index).toBe(
      2,
    );
    expect(
      moveBefore(OUTLINE, { kind: 'account', id: CASH }, { accountType: 'asset', groupId: SAVINGS_GROUP.id }, null)
        .index,
    ).toBe(0);
  });
});

describe('movedInChart', () => {
  it("reorders a node within its Account type's list, leaving every other Account type as it was", () => {
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'group', id: SAVINGS_GROUP.id },
        accountType: 'asset',
        groupId: null,
        index: 0,
      }),
    ).toEqual([OUTLINE[3], OUTLINE[0], OUTLINE[1], OUTLINE[2], OUTLINE[4]]);
  });

  it('moves an Account into an Account group at the place given, as one of its Accounts', () => {
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'account', id: WALLET_ACCOUNT.id },
        accountType: 'asset',
        groupId: BANK,
        index: 1,
      }),
    ).toEqual([
      OUTLINE[0],
      {
        kind: 'group',
        group: BANK_GROUP,
        accounts: [ABC_BANK, { ...WALLET_ACCOUNT, groupId: BANK }, XYZ_BANK],
      },
      OUTLINE[3],
      OUTLINE[4],
    ]);
  });

  it('moves an Account out of its Account group, and between Account groups', () => {
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'account', id: XYZ_BANK.id },
        accountType: 'asset',
        groupId: null,
        index: 0,
      }),
    ).toEqual([
      { kind: 'account', account: { ...XYZ_BANK, groupId: null } },
      OUTLINE[0],
      { kind: 'group', group: BANK_GROUP, accounts: [ABC_BANK] },
      OUTLINE[2],
      OUTLINE[3],
      OUTLINE[4],
    ]);
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'account', id: ABC_BANK.id },
        accountType: 'asset',
        groupId: SAVINGS_GROUP.id,
        index: 0,
      }),
    ).toEqual([
      OUTLINE[0],
      { kind: 'group', group: BANK_GROUP, accounts: [XYZ_BANK] },
      OUTLINE[2],
      { kind: 'group', group: SAVINGS_GROUP, accounts: [{ ...ABC_BANK, groupId: SAVINGS_GROUP.id }] },
      OUTLINE[4],
    ]);
  });

  it('leaves the chart as it is for a node it does not hold, an Account taken for a group, or a group moved into a group', () => {
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'account', id: BANK as string as AccountId },
        accountType: 'asset',
        groupId: null,
        index: 0,
      }),
    ).toEqual(OUTLINE);
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'group', id: ABC_BANK.id as string as AccountGroupId },
        accountType: 'asset',
        groupId: null,
        index: 0,
      }),
    ).toEqual(OUTLINE);
    expect(
      movedInChart(OUTLINE, {
        node: { kind: 'group', id: SAVINGS_GROUP.id },
        accountType: 'asset',
        groupId: BANK,
        index: 0,
      }),
    ).toEqual(OUTLINE);
  });
});

const form = (fields: Readonly<Record<string, string>>): { get: (name: string) => unknown } => ({
  get: (name) => fields[name] ?? null,
});

describe('parseAccountForm', () => {
  it('reads the name, description, Account group and Active period an Account dialog submits', () => {
    expect(
      parseAccountForm(
        form({
          name: ' Wallet ',
          description: 'Cash I carry',
          group: BANK,
          activeFrom: '2026-10-09',
          activeUntil: '2026-12-31',
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        name: ' Wallet ',
        description: 'Cash I carry',
        groupId: BANK,
        activeFrom: '2026-10-09',
        activeUntil: '2026-12-31',
      },
    });
  });

  it('reads an empty Active until, or none, as an Active period with no end', () => {
    const open = { name: 'Wallet', description: '', activeFrom: '2026-10-09' };

    expect(parseAccountForm(form({ ...open, activeUntil: '' }))).toEqual({
      ok: true,
      value: { ...open, groupId: null, activeUntil: null },
    });
    expect(parseAccountForm(form(open))).toEqual({
      ok: true,
      value: { ...open, groupId: null, activeUntil: null },
    });
  });

  it('reads an empty Group, or none, as no Account group', () => {
    const ungrouped = parseAccountForm(form({ name: 'Wallet', group: '', activeFrom: '2026-10-09' }));
    const unasked = parseAccountForm(form({ name: 'Wallet', activeFrom: '2026-10-09' }));

    expect(ungrouped.ok && ungrouped.value.groupId).toBeNull();
    expect(unasked.ok && unasked.value.groupId).toBeNull();
  });

  it('reads a form with no description as an empty one', () => {
    const parsed = parseAccountForm(form({ name: 'Wallet', activeFrom: '2026-10-09' }));

    expect(parsed.ok && parsed.value.description).toBe('');
  });

  it('refuses a form with no name, or a start or an end that is not a day', () => {
    const refused = { ok: false, error: { code: 'INVALID_INPUT', message: expect.any(String) as unknown } };

    expect(parseAccountForm(form({ activeFrom: '2026-10-09' }))).toEqual(refused);
    expect(parseAccountForm(form({ name: 'Wallet', activeFrom: '' }))).toEqual(refused);
    expect(
      parseAccountForm(form({ name: 'Wallet', activeFrom: '2026-10-09', activeUntil: 'soon' })),
    ).toEqual(refused);
  });

  it('refuses a Group that is not an Account group id', () => {
    expect(parseAccountForm(form({ name: 'Wallet', group: 'Bank', activeFrom: '2026-10-09' }))).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'The account form is incomplete or malformed.' },
    });
  });
});

describe('parseAccountGroupForm', () => {
  it('reads the name and description an Account group dialog submits', () => {
    expect(parseAccountGroupForm(form({ name: ' Bank ', description: 'Accounts at a bank' }))).toEqual({
      ok: true,
      value: { name: ' Bank ', description: 'Accounts at a bank' },
    });
  });

  it('reads a form with no description as an empty one', () => {
    const parsed = parseAccountGroupForm(form({ name: 'Bank' }));

    expect(parsed.ok && parsed.value.description).toBe('');
  });

  it('refuses a form with no name', () => {
    expect(parseAccountGroupForm(form({ description: 'Accounts at a bank' }))).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'The Account group form is incomplete or malformed.' },
    });
  });
});

describe('addAccountGroupInputSchema and editAccountGroupInputSchema', () => {
  const details = { name: 'Bank', description: '' };

  it('takes an Account type to add an Account group under, and an Account group id to edit one', () => {
    expect(addAccountGroupInputSchema.parse({ ...details, accountType: 'asset' })).toEqual({
      ...details,
      accountType: 'asset',
    });
    expect(editAccountGroupInputSchema.parse({ ...details, id: BANK })).toEqual({ ...details, id: BANK });
  });

  it('refuses an unknown Account type, or an id that is not an Account group id', () => {
    expect(addAccountGroupInputSchema.safeParse({ ...details, accountType: 'bank' }).success).toBe(false);
    expect(editAccountGroupInputSchema.safeParse({ ...details, id: 'bank' }).success).toBe(false);
  });
});

describe('addAccountInputSchema and editAccountInputSchema', () => {
  const details = {
    name: 'Wallet',
    description: '',
    groupId: BANK,
    activeFrom: '2026-10-09',
    activeUntil: null,
  };

  it('takes an Account type to add an Account under, and an Account id to edit one', () => {
    expect(addAccountInputSchema.parse({ ...details, accountType: 'asset' })).toEqual({
      ...details,
      accountType: 'asset',
    });
    expect(editAccountInputSchema.parse({ ...details, id: CASH })).toEqual({ ...details, id: CASH });
  });

  it('refuses an unknown Account type, or an id that is not an Account id', () => {
    expect(addAccountInputSchema.safeParse({ ...details, accountType: 'cash' }).success).toBe(false);
    expect(editAccountInputSchema.safeParse({ ...details, id: 'cash' }).success).toBe(false);
  });
});

describe('moveChartNodeInputSchema', () => {
  const move = {
    node: { kind: 'account', id: CASH },
    accountType: 'asset',
    groupId: BANK,
    index: 2,
  } as const;

  it('carries the Account or Account group to move, and the list and place it moves to', () => {
    expect(moveChartNodeInputSchema.parse(move)).toEqual(move);
    expect(
      moveChartNodeInputSchema.parse({ ...move, node: { kind: 'group', id: BANK }, groupId: null, index: 0 }),
    ).toEqual({ ...move, node: { kind: 'group', id: BANK }, groupId: null, index: 0 });
  });

  it('refuses a node of no kind or no id, an unknown Account type, and a place that is not a whole number from nought', () => {
    for (const malformed of [
      { ...move, node: { kind: 'ledger', id: CASH } },
      { ...move, node: { kind: 'account', id: 'cash' } },
      { ...move, accountType: 'cash' },
      { ...move, groupId: 'bank' },
      { ...move, index: -1 },
      { ...move, index: 1.5 },
    ]) {
      expect(moveChartNodeInputSchema.safeParse(malformed).success).toBe(false);
    }
  });
});

describe('deleteAccountInputSchema and deleteAccountGroupInputSchema', () => {
  it('carries the id of the Account or Account group to delete', () => {
    expect(deleteAccountInputSchema.parse({ id: CASH })).toEqual({ id: CASH });
    expect(deleteAccountGroupInputSchema.parse({ id: BANK })).toEqual({ id: BANK });
  });

  it('refuses an input whose id is missing or not an id', () => {
    expect(deleteAccountInputSchema.safeParse({}).success).toBe(false);
    expect(deleteAccountInputSchema.safeParse({ id: 'cash' }).success).toBe(false);
    expect(deleteAccountGroupInputSchema.safeParse({}).success).toBe(false);
    expect(deleteAccountGroupInputSchema.safeParse({ id: 'bank' }).success).toBe(false);
  });
});
