import { describe, expect, it } from 'vitest';
import {
  isErr,
  isOk,
  type AccountId,
  type DomainErrorCode,
  type EntryId,
  type Money,
  type Side,
} from '@repo/contracts';
import { type Account, type AccountNames } from '../../accounts/domain/account';
import { MONEY_ZERO, money } from '../../money/domain/money';
import { makeEntry, makePostedEntry, type EntryDraft } from './entry';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const PAYABLE = '01920000-0000-7000-8000-00000000c002' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const BANK = '01920000-0000-7000-8000-00000000c0ff' as AccountId;

const NAMES: AccountNames = new Map([
  [CASH, { id: CASH, name: 'Cash' }],
  [PAYABLE, { id: PAYABLE, name: 'Accounts payable' }],
  [EXPENSES, { id: EXPENSES, name: 'Expenses' }],
]);

const amount = (minorUnits: number): Money => {
  const result = money(minorUnits);
  expect(isOk(result), `test setup used an invalid amount: ${String(minorUnits)}`).toBe(true);
  return isOk(result) ? result.value : MONEY_ZERO;
};

const line = (account: AccountId, side: Side, minorUnits: number): EntryDraft['lines'][number] => ({
  account,
  side,
  amount: amount(minorUnits),
});

const STAMP = {
  id: '01920000-0000-7000-8000-000000000001' as EntryId,
  createdAt: new Date('2026-09-15T00:30:00.000Z'),
};

const OFFICE_SUPPLIES: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [line(EXPENSES, 'debit', 12500), line(CASH, 'credit', 12500)],
};

const expectRefused = (
  draft: EntryDraft,
  code: DomainErrorCode,
  reason: string,
): void => {
  const result = makeEntry(draft, STAMP, NAMES);

  expect(isErr(result)).toBe(true);
  if (!isErr(result)) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message).toContain(reason);
};

const withLines = (...lines: EntryDraft['lines']): EntryDraft => ({ ...OFFICE_SUPPLIES, lines });

describe('makeEntry', () => {
  it('builds a balanced entry, stamped, with its lines in order, named, and its total', () => {
    const result = makeEntry(OFFICE_SUPPLIES, STAMP, NAMES);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value).toEqual({
      id: STAMP.id,
      entryDate: '2026-09-15',
      memo: 'Office supplies',
      lines: [
        { account: EXPENSES, accountName: 'Expenses', side: 'debit', amount: 12500 },
        { account: CASH, accountName: 'Cash', side: 'credit', amount: 12500 },
      ],
      total: 12500,
      createdAt: STAMP.createdAt,
    });
  });

  it('totals the debits, not whichever line comes first', () => {
    const result = makeEntry(
      withLines(
        line(EXPENSES, 'debit', 10000),
        line(EXPENSES, 'debit', 2500),
        line(CASH, 'credit', 12500),
      ),
      STAMP,
      NAMES,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(12500);
  });

  it('balances a credit split across lines, and lets an account appear twice', () => {
    const result = makeEntry(
      withLines(
        line(CASH, 'credit', 5000),
        line(EXPENSES, 'debit', 12500),
        line(CASH, 'credit', 7500),
      ),
      STAMP,
      NAMES,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(12500);
    expect(result.value.lines.map((entered) => entered.amount)).toEqual([5000, 12500, 7500]);
  });

  it('refuses an entry whose debits and credits differ, as an imbalance', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 12500), line(CASH, 'credit', 12000)),
      'UNBALANCED',
      'differ',
    );
  });

  it('refuses an imbalance on the credit side too', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 12000), line(CASH, 'credit', 12500)),
      'UNBALANCED',
      'differ',
    );
  });

  it.each([CASH, PAYABLE, EXPENSES])('accepts %s, from the chart of accounts', (account) => {
    const result = makeEntry(
      withLines(line(account, 'debit', 100), line(account, 'credit', 100)),
      STAMP,
      NAMES,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.lines.map((named) => named.accountName)).toEqual([
      NAMES.get(account)?.name,
      NAMES.get(account)?.name,
    ]);
  });

  it('refuses an account that is not in the chart', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 100), line(BANK, 'credit', 100)),
      'INVALID_INPUT',
      'chart of accounts',
    );
  });

  it('refuses an account named by anything but its id, such as its name', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 100), { account: 'Cash', side: 'credit', amount: amount(100) }),
      'INVALID_INPUT',
      'chart of accounts',
    );
  });

  it('refuses fewer than two lines', () => {
    expectRefused(withLines(line(EXPENSES, 'debit', 100)), 'INVALID_INPUT', 'two or more lines');
    expectRefused(withLines(), 'INVALID_INPUT', 'two or more lines');
  });

  it('refuses lines that are all debits or all credits, even when there are two', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 100), line(CASH, 'debit', 100)),
      'INVALID_INPUT',
      'one debit and one credit',
    );
    expectRefused(
      withLines(line(EXPENSES, 'credit', 100), line(CASH, 'credit', 100)),
      'INVALID_INPUT',
      'one debit and one credit',
    );
  });

  it('refuses a zero amount, even when the entry would balance', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', 0), line(CASH, 'credit', 0)),
      'INVALID_INPUT',
      'greater than zero',
    );
  });

  it('refuses a negative amount, because the side carries the direction', () => {
    expectRefused(
      withLines(line(EXPENSES, 'debit', -100), line(CASH, 'credit', -100)),
      'INVALID_INPUT',
      'greater than zero',
    );
  });

  it('refuses debits too large to add up exactly, rather than rounding them', () => {
    expectRefused(
      withLines(
        line(EXPENSES, 'debit', Number.MAX_SAFE_INTEGER),
        line(EXPENSES, 'debit', 1),
        line(CASH, 'credit', 1),
      ),
      'INVALID_INPUT',
      'debits add up',
    );
  });

  it('refuses credits too large to add up exactly, rather than rounding them', () => {
    expectRefused(
      withLines(
        line(EXPENSES, 'debit', 1),
        line(CASH, 'credit', Number.MAX_SAFE_INTEGER),
        line(CASH, 'credit', 1),
      ),
      'INVALID_INPUT',
      'credits add up',
    );
  });

  it('accepts the largest amount that still adds up exactly', () => {
    const result = makeEntry(
      withLines(
        line(EXPENSES, 'debit', Number.MAX_SAFE_INTEGER),
        line(CASH, 'credit', Number.MAX_SAFE_INTEGER),
      ),
      STAMP,
      NAMES,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('stores the memo trimmed', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, memo: '  Office supplies \n' }, STAMP, NAMES);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.memo).toBe('Office supplies');
  });

  it('refuses a memo that is empty once trimmed', () => {
    expectRefused({ ...OFFICE_SUPPLIES, memo: '' }, 'INVALID_INPUT', 'memo');
    expectRefused({ ...OFFICE_SUPPLIES, memo: ' \t\n ' }, 'INVALID_INPUT', 'memo');
  });

  it('accepts a memo of 200 characters, and refuses 201', () => {
    expect(isOk(makeEntry({ ...OFFICE_SUPPLIES, memo: 'm'.repeat(200) }, STAMP, NAMES))).toBe(true);
    expectRefused({ ...OFFICE_SUPPLIES, memo: 'm'.repeat(201) }, 'INVALID_INPUT', '1 to 200');
  });

  it('counts a memo in code points, so 200 emoji fit though they are 400 UTF-16 units', () => {
    const grinning = String.fromCodePoint(0x1f600);

    expect(isOk(makeEntry({ ...OFFICE_SUPPLIES, memo: grinning.repeat(200) }, STAMP, NAMES))).toBe(true);
    expectRefused(
      { ...OFFICE_SUPPLIES, memo: grinning.repeat(201) },
      'INVALID_INPUT',
      '1 to 200',
    );
  });

  it('counts the limit after trimming', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, memo: ` ${'m'.repeat(200)} ` }, STAMP, NAMES);

    expect(isOk(result)).toBe(true);
  });

  it('accepts a day in the future, which is still a day', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, entryDate: '2126-01-01' }, STAMP, NAMES);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.entryDate).toBe('2126-01-01');
  });
});

describe('makePostedEntry', () => {
  const chartAccount = (
    id: AccountId,
    name: string,
    activeFrom: string,
    activeUntil: string | null,
  ): Account => ({
    id,
    accountType: 'asset',
    groupId: null,
    name,
    description: null,
    position: 0,
    activeFrom,
    activeUntil,
  });

  const CHART: readonly Account[] = [
    chartAccount(CASH, 'Cash', '2026-09-01', '2026-09-30'),
    chartAccount(EXPENSES, 'Expenses', '2026-09-15', null),
  ];

  it('builds the entry, named from the chart, when every Account it names is active on its day', () => {
    expect(makePostedEntry(OFFICE_SUPPLIES, STAMP, CHART)).toEqual(
      makeEntry(OFFICE_SUPPLIES, STAMP, NAMES),
    );
  });

  it('refuses as invalid input an entry dated before an Account it names starts', () => {
    const result = makePostedEntry({ ...OFFICE_SUPPLIES, entryDate: '2026-09-14' }, STAMP, CHART);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(isErr(result) && result.error.message).toContain('"Expenses"');
  });

  it('refuses as invalid input an entry dated after an Account it names ends', () => {
    const result = makePostedEntry({ ...OFFICE_SUPPLIES, entryDate: '2026-10-01' }, STAMP, CHART);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(isErr(result) && result.error.message).toContain('"Cash"');
  });

  it('refuses first what makes the entry no entry at all, before the Active period', () => {
    const result = makePostedEntry(
      { ...OFFICE_SUPPLIES, entryDate: '2026-10-01', memo: ' ' },
      STAMP,
      CHART,
    );

    expect(isErr(result) && result.error.message).toContain('memo');
  });
});
