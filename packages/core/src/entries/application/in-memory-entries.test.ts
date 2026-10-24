import { describe, expect, it } from 'vitest';
import { isOk, type AccountId, type EntryId, type Money, type UserId } from '@repo/contracts';
import { makeEntry, type Entry } from '../domain/entry';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const NAMES = new Map([
  [CASH, { id: CASH, name: 'Cash' }],
  [EXPENSES, { id: EXPENSES, name: 'Expenses' }],
]);

function spent(n: number, amount: number): Entry {
  const made = makeEntry(
    {
      entryDate: '2026-06-15',
      title: '',
      memo: '',
      lines: [
        { account: EXPENSES, side: 'debit', amount: amount as Money },
        { account: CASH, side: 'credit', amount: amount as Money },
      ],
    },
    {
      id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as EntryId,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    },
    NAMES,
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

describe('inMemoryEntries accountTotals', () => {
  it('refuses sums too large for an amount to hold, rather than answering with them', async () => {
    const { entries } = inMemoryEntries();
    await entries.save(ADA, spent(1, Number.MAX_SAFE_INTEGER));
    await entries.save(ADA, spent(2, Number.MAX_SAFE_INTEGER));

    const totals = await entries.accountTotals(ADA, { from: '2026-06-01', to: '2026-06-30' });

    expect(!totals.ok && totals.error.code).toBe('INVALID_INPUT');
  });
});
