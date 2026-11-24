import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isOk,
  ok,
  type AccountId,
  type EntryId,
  type Money,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT } from '../../auth/domain/auth-context';
import { makeEntry, type Entry } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';
import { createGetEntryLog } from './get-entry-log';
import { inMemoryEntries } from './in-memory-entries';

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;
const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const NAMES = new Map([
  [CASH, { id: CASH, name: 'Cash' }],
  [EXPENSES, { id: EXPENSES, name: 'Expenses' }],
]);

function entry(n: number, enteredAt: string): Entry {
  const made = makeEntry(
    {
      entryDate: '2026-09-15',
      title: '',
      memo: '',
      lines: [
        { account: EXPENSES, side: 'debit', amount: 100 as Money },
        { account: CASH, side: 'credit', amount: 100 as Money },
      ],
    },
    {
      id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as EntryId,
      createdAt: new Date(enteredAt),
      enteredAt: new Date(enteredAt),
    },
    NAMES,
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

const withEntryLog = (entryLog: EntryRepository['entryLog']): EntryRepository => ({
  ...inMemoryEntries().entries,
  entryLog,
});

describe('createGetEntryLog', () => {
  it('refuses a caller who is not signed in without reading any entries', async () => {
    const getEntryLog = createGetEntryLog({
      entries: withEntryLog(() => Promise.reject(new Error('The log was read.'))),
    });

    const log = await getEntryLog(SIGNED_OUT);

    expect(!log.ok && log.error.code).toBe('UNAUTHENTICATED');
  });

  it('answers with the signed-in User entries newest first and no one else', async () => {
    const { entries } = inMemoryEntries();
    const older = entry(1, '2026-09-15T10:00:00.000Z');
    const newer = entry(2, '2026-09-15T11:00:00.000Z');
    await entries.save(ADA, older);
    await entries.save(GRACE, entry(3, '2026-09-15T12:00:00.000Z'));
    await entries.save(ADA, newer);

    const log = await createGetEntryLog({ entries })({ userId: ADA });

    expect(log).toEqual(ok([newer, older]));
  });

  it('answers with an empty log for a User with no entries', async () => {
    const log = await createGetEntryLog({ entries: inMemoryEntries().entries })({ userId: ADA });

    expect(log).toEqual(ok([]));
  });

  it('passes on the failure of the repository as it is', async () => {
    const failure = domainError('NOT_FOUND', 'Gone.');
    const getEntryLog = createGetEntryLog({
      entries: withEntryLog(() => Promise.resolve(err(failure))),
    });

    const log = await getEntryLog({ userId: ADA });

    expect(log).toEqual(err(failure));
  });
});
