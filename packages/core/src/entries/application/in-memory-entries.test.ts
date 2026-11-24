import { describe, expect, it } from 'vitest';
import { isOk, type AccountId, type EntryId, type Money, type UserId } from '@repo/contracts';
import { makeEntry, type Entry } from '../domain/entry';
import { makeReversal } from '../domain/reversal';
import { type EntryRepository } from '../ports/entry-repository';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;
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
      enteredAt: new Date('2026-10-01T00:00:00.000Z'),
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

function stamped(n: number, enteredAt: string, entryDate = '2026-06-15', createdAt = enteredAt): Entry {
  return {
    ...spent(n, 100),
    entryDate,
    createdAt: new Date(createdAt),
    enteredAt: new Date(enteredAt),
  };
}

async function logged(entries: EntryRepository, userId: UserId): Promise<number[]> {
  const log = await entries.entryLog(userId);
  return isOk(log) ? log.value.map((entry) => Number(entry.id.slice(-12))) : [];
}

describe('inMemoryEntries entryLog', () => {
  it('lists entries by when they were entered, newest first, whatever their dates', async () => {
    const { entries } = inMemoryEntries();
    await entries.save(ADA, stamped(1, '2026-10-01T10:00:00.000Z', '2026-12-31', '2026-10-01T12:00:00.000Z'));
    await entries.save(ADA, stamped(2, '2026-10-01T12:00:00.000Z', '2026-01-01', '2026-10-01T10:00:00.000Z'));
    await entries.save(ADA, stamped(3, '2026-10-01T11:00:00.000Z', '2026-06-15', '2026-09-01T00:00:00.000Z'));

    expect(await logged(entries, ADA)).toEqual([2, 3, 1]);
  });

  it('puts the larger entry id first when two were entered at the same moment', async () => {
    const { entries } = inMemoryEntries();
    await entries.save(ADA, stamped(2, '2026-10-01T10:00:00.000Z'));
    await entries.save(ADA, stamped(3, '2026-10-01T10:00:00.000Z'));
    await entries.save(ADA, stamped(1, '2026-10-01T10:00:00.000Z'));

    expect(await logged(entries, ADA)).toEqual([3, 2, 1]);
  });

  it('lists only the entries of the User asked about', async () => {
    const { entries } = inMemoryEntries();
    await entries.save(ADA, stamped(1, '2026-10-01T10:00:00.000Z'));
    await entries.save(GRACE, stamped(2, '2026-10-01T11:00:00.000Z'));

    expect(await logged(entries, ADA)).toEqual([1]);
    expect(await logged(entries, GRACE)).toEqual([2]);
  });

  it('leaves out reversals and the entries they reversed', async () => {
    const { entries } = inMemoryEntries();
    const wrong = stamped(2, '2026-10-01T11:00:00.000Z');
    await entries.save(ADA, stamped(1, '2026-10-01T10:00:00.000Z'));
    await entries.save(ADA, wrong);
    await entries.saveReversal(
      ADA,
      makeReversal(wrong, {
        id: '01920000-0000-7000-8000-000000000009' as EntryId,
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        enteredAt: new Date('2026-10-01T12:00:00.000Z'),
      }),
    );

    expect(await logged(entries, ADA)).toEqual([1]);
  });

  it('answers with an empty list when the User has no entries', async () => {
    const { entries } = inMemoryEntries();
    await entries.save(GRACE, stamped(1, '2026-10-01T10:00:00.000Z'));

    expect(await entries.entryLog(ADA)).toEqual({ ok: true, value: [] });
  });
});
