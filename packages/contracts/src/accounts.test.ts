import { describe, expect, it } from 'vitest';
import {
  accountIdSchema,
  accountSchema,
  accountTypeSchema,
  addAccountInputSchema,
  chartSchema,
  editAccountInputSchema,
  parseAccountForm,
  toChart,
  type AccountId,
} from './accounts';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;

const CASH_ACCOUNT = {
  id: CASH,
  accountType: 'asset',
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

  it('refuses an Account of no known Account type, or with a start that is not a day', () => {
    expect(accountSchema.safeParse({ ...CASH_ACCOUNT, accountType: 'cash' }).success).toBe(false);
    expect(
      accountSchema.safeParse({ ...CASH_ACCOUNT, activeFrom: '2026-09-01T00:00:00Z' }).success,
    ).toBe(false);
  });
});

describe('toChart', () => {
  it('keeps the order and the fields the wire carries, and drops the rest', () => {
    const sales = {
      ...CASH_ACCOUNT,
      id: '01920000-0000-7000-8000-00000000c004' as AccountId,
      accountType: 'revenue',
      name: 'Sales',
      description: 'Takings',
      activeUntil: '2026-12-31',
    } as const;
    const stored = [
      { ...sales, position: 3 },
      { ...CASH_ACCOUNT, position: 0 },
    ];

    const chart = toChart(stored);

    expect(chart).toEqual([
      {
        id: sales.id,
        accountType: 'revenue',
        name: 'Sales',
        description: 'Takings',
        activeFrom: '2026-09-01',
        activeUntil: '2026-12-31',
      },
      CASH_ACCOUNT,
    ]);
    expect(chartSchema.parse(chart)).toEqual(chart);
  });
});

const form = (fields: Readonly<Record<string, string>>): { get: (name: string) => unknown } => ({
  get: (name) => fields[name] ?? null,
});

describe('parseAccountForm', () => {
  it('reads the name, description and Active period an Account dialog submits', () => {
    expect(
      parseAccountForm(
        form({
          name: ' Wallet ',
          description: 'Cash I carry',
          activeFrom: '2026-10-09',
          activeUntil: '2026-12-31',
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        name: ' Wallet ',
        description: 'Cash I carry',
        activeFrom: '2026-10-09',
        activeUntil: '2026-12-31',
      },
    });
  });

  it('reads an empty Active until, or none, as an Active period with no end', () => {
    const open = { name: 'Wallet', description: '', activeFrom: '2026-10-09' };

    expect(parseAccountForm(form({ ...open, activeUntil: '' }))).toEqual({
      ok: true,
      value: { ...open, activeUntil: null },
    });
    expect(parseAccountForm(form(open))).toEqual({ ok: true, value: { ...open, activeUntil: null } });
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
});

describe('addAccountInputSchema and editAccountInputSchema', () => {
  const details = {
    name: 'Wallet',
    description: '',
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
