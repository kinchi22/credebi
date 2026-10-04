import { describe, expect, it } from 'vitest';
import { isOk, type EntryId, type Money } from '@repo/contracts';
import { makeEntry, type Entry } from './entry';
import { makeReversal } from './reversal';

const ORIGINAL_ID = '01920000-0000-7000-8000-000000000001' as EntryId;
const REVERSAL_STAMP = {
  id: '01920000-0000-7000-8000-000000000002' as EntryId,
  createdAt: new Date('2026-10-04T09:00:00.000Z'),
};

function original(): Entry {
  const made = makeEntry(
    {
      entryDate: '2026-09-15',
      memo: 'Rent',
      lines: [
        { account: 'expense', side: 'debit', amount: 70000 as Money },
        { account: 'cash', side: 'credit', amount: 40000 as Money },
        { account: 'payable', side: 'credit', amount: 30000 as Money },
      ],
    },
    { id: ORIGINAL_ID, createdAt: new Date('2026-09-15T00:30:00.000Z') },
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

describe('makeReversal', () => {
  it('builds an Entry of the same Accounts and amounts with each Side swapped, on the same day with the same memo, linked to the original', () => {
    expect(makeReversal(original(), REVERSAL_STAMP)).toEqual({
      id: REVERSAL_STAMP.id,
      entryDate: '2026-09-15',
      memo: 'Rent',
      lines: [
        { account: 'expense', side: 'credit', amount: 70000 },
        { account: 'cash', side: 'debit', amount: 40000 },
        { account: 'payable', side: 'debit', amount: 30000 },
      ],
      total: 70000,
      createdAt: REVERSAL_STAMP.createdAt,
      reverses: ORIGINAL_ID,
    });
  });

  it('turns a credit into a debit as well as a debit into a credit', () => {
    const reversal = makeReversal(original(), REVERSAL_STAMP);

    expect(makeReversal(reversal, REVERSAL_STAMP).lines).toEqual(original().lines);
  });
});
