import type { AccountGroupId, AccountId, ChartOutput, Side } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { linesOnDay, offeredOn } from './lines-on-day';

const id = (tail: string): string => `01920000-0000-7000-8000-${tail.padStart(12, '0')}`;

const account = (
  tail: string,
  name: string,
  activeFrom: string,
  activeUntil: string | null,
  groupId: AccountGroupId | null = null,
) => ({
  id: id(tail) as AccountId,
  accountType: 'asset' as const,
  groupId,
  name,
  description: null,
  activeFrom,
  activeUntil,
});

const BANK = {
  id: id('b001') as AccountGroupId,
  accountType: 'asset' as const,
  name: 'Bank',
  description: null,
};

const CASH = account('c001', 'Cash', '2026-01-01', null);
const OLD_WALLET = account('c002', 'Old wallet', '2026-09-01', '2026-09-30');
const NEW_BANK = account('c003', 'New bank', '2026-10-01', null, BANK.id);

const CHART: ChartOutput = [
  { kind: 'account', account: CASH },
  { kind: 'account', account: OLD_WALLET },
  { kind: 'group', group: BANK, accounts: [NEW_BANK] },
];

const line = (side: Side, account: { readonly id: AccountId }, amount: string) => ({
  side,
  account: account.id,
  amount,
});

const CREDIT_CASH = line('credit', CASH, '12500');
const DEBIT_WALLET = line('debit', OLD_WALLET, '500');
const DEBIT_BANK = line('debit', NEW_BANK, '12000');
const LINES = [CREDIT_CASH, DEBIT_WALLET, DEBIT_BANK];

describe('offeredOn', () => {
  it('offers the whole chart while no day is chosen', () => {
    expect(offeredOn(CHART, undefined).chart).toEqual(CHART);
    expect(offeredOn(CHART, '').ids).toEqual(new Set([CASH.id, OLD_WALLET.id, NEW_BANK.id]));
  });

  it('offers only the Accounts active on the day, and leaves out a group with none', () => {
    const offered = offeredOn(CHART, '2026-09-15');
    expect(offered.chart).toEqual([
      { kind: 'account', account: CASH },
      { kind: 'account', account: OLD_WALLET },
    ]);
    expect(offered.ids).toEqual(new Set([CASH.id, OLD_WALLET.id]));
  });

  it('keeps a group with the Accounts of it active on the day', () => {
    expect(offeredOn(CHART, '2026-10-05').chart).toEqual([
      { kind: 'account', account: CASH },
      { kind: 'group', group: BANK, accounts: [NEW_BANK] },
    ]);
  });
});

describe('linesOnDay', () => {
  it('counts every line, debits first, and holds none back when each Account is active on the day', () => {
    const lines = linesOnDay(offeredOn(CHART, '2026-09-30'), [DEBIT_WALLET, CREDIT_CASH]);
    expect(lines).toEqual({ counted: [DEBIT_WALLET, CREDIT_CASH], notActive: [] });
  });

  it('leaves a line whose Account is not active on the day out of the count, and holds it back', () => {
    const lines = linesOnDay(offeredOn(CHART, '2026-10-05'), LINES);
    expect(lines).toEqual({ counted: [DEBIT_BANK, CREDIT_CASH], notActive: [DEBIT_WALLET] });
  });

  it('lists every line not active on the day in the form\'s order, debits first', () => {
    const lines = linesOnDay(offeredOn(CHART, '2026-09-15'), [
      line('credit', NEW_BANK, '1'),
      DEBIT_WALLET,
      DEBIT_BANK,
    ]);
    expect(lines.notActive).toEqual([DEBIT_BANK, line('credit', NEW_BANK, '1')]);
    expect(lines.counted).toEqual([DEBIT_WALLET]);
  });

  it('treats a line whose Account is not in the chart as not active', () => {
    const gone = { side: 'debit' as const, account: id('dead') as AccountId, amount: '1' };
    const lines = linesOnDay(offeredOn(CHART, undefined), [gone, CREDIT_CASH]);
    expect(lines).toEqual({ counted: [CREDIT_CASH], notActive: [gone] });
  });

  it('holds no line back when there is none', () => {
    expect(linesOnDay(offeredOn(CHART, '2026-09-15'), [])).toEqual({ counted: [], notActive: [] });
  });
});
