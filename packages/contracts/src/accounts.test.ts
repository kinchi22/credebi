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
  editAccountGroupInputSchema,
  editAccountInputSchema,
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
