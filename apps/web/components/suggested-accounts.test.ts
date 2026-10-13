import type { AccountId, ChartOutput, OfferedTitle } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { offeredOn } from './lines-on-day';
import { suggestedOn, titleMatching } from './suggested-accounts';

const id = (tail: string): AccountId => `01920000-0000-7000-8000-${tail.padStart(12, '0')}` as AccountId;

const account = (tail: string, name: string, activeUntil: string | null = null) => ({
  id: id(tail),
  accountType: 'asset' as const,
  groupId: null,
  name,
  description: null,
  activeFrom: '2026-01-01',
  activeUntil,
});

const CASH = account('c001', 'Cash');
const BANK = account('c002', 'Bank');
const SALES = account('c003', 'Sales');
const OLD_WALLET = account('c004', 'Old wallet', '2026-01-31');
const EXPENSES = account('c005', 'Expenses');

const CHART: ChartOutput = [
  { kind: 'account', account: CASH },
  { kind: 'account', account: BANK },
  { kind: 'account', account: OLD_WALLET },
  { kind: 'account', account: SALES },
  { kind: 'account', account: EXPENSES },
];

const offered = (title: string, debit: readonly AccountId[], credit: readonly AccountId[]): OfferedTitle => ({
  title,
  lines: [],
  suggested: { debit: [...debit], credit: [...credit] },
});

const TITLES: readonly OfferedTitle[] = [
  offered('Groceries', [EXPENSES.id], [CASH.id]),
  offered('Salary', [BANK.id], [SALES.id]),
];

const namesOf = (suggested: ReturnType<typeof suggestedOn>) => ({
  debit: suggested.debit.map(({ name }) => name),
  credit: suggested.credit.map(({ name }) => name),
});

describe('titleMatching', () => {
  it('finds the offered Title the typed one matches, ignoring case', () => {
    expect(titleMatching(TITLES, 'gROCERIES')?.title).toBe('Groceries');
  });

  it('ignores space around the typed Title', () => {
    expect(titleMatching(TITLES, '  Salary ')?.title).toBe('Salary');
  });

  it('finds nothing for a Title only part of an offered one', () => {
    expect(titleMatching(TITLES, 'Grocer')).toBeUndefined();
  });

  it('finds nothing for an empty Title, even when an offered Title is empty', () => {
    expect(titleMatching([...TITLES, offered('', [CASH.id], [])], '  ')).toBeUndefined();
  });
});

describe('suggestedOn', () => {
  it('suggests per Side the Accounts in their ranked order, as the Chart names them', () => {
    expect(
      namesOf(suggestedOn(offered('Rent', [EXPENSES.id, CASH.id], [BANK.id, SALES.id]), offeredOn(CHART, '2026-09-15'))),
    ).toEqual({ debit: ['Expenses', 'Cash'], credit: ['Bank', 'Sales'] });
  });

  it('suggests at most three Accounts per Side', () => {
    expect(
      namesOf(
        suggestedOn(
          offered('Rent', [EXPENSES.id, CASH.id, BANK.id, SALES.id], []),
          offeredOn(CHART, '2026-09-15'),
        ),
      ).debit,
    ).toEqual(['Expenses', 'Cash', 'Bank']);
  });

  it('drops Accounts not active on the day before taking three', () => {
    const allowance = offered('Allowance', [OLD_WALLET.id, EXPENSES.id, CASH.id, BANK.id], []);

    expect(namesOf(suggestedOn(allowance, offeredOn(CHART, '2026-09-15'))).debit).toEqual([
      'Expenses',
      'Cash',
      'Bank',
    ]);
    expect(namesOf(suggestedOn(allowance, offeredOn(CHART, '2026-01-15'))).debit).toEqual([
      'Old wallet',
      'Expenses',
      'Cash',
    ]);
  });

  it('drops an Account no longer in the Chart', () => {
    expect(
      namesOf(suggestedOn(offered('Rent', [id('dead'), CASH.id], []), offeredOn(CHART, '2026-09-15'))).debit,
    ).toEqual(['Cash']);
  });

  it('suggests nothing when no Title matches', () => {
    expect(namesOf(suggestedOn(undefined, offeredOn(CHART, '2026-09-15')))).toEqual({
      debit: [],
      credit: [],
    });
  });
});
