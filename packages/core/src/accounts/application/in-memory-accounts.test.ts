import { describe, expect, it } from 'vitest';
import { ok, type AccountGroupId, type AccountId, type UserId } from '@repo/contracts';
import { type Account, type AccountGroup } from '../domain/account';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;

const CASH: Account = {
  id: '01920000-0000-7000-8000-000000000001' as AccountId,
  accountType: 'asset',
  groupId: null,
  name: 'Cash',
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
};

const BANK: AccountGroup = {
  id: '01920000-0000-7000-8000-000000000b01' as AccountGroupId,
  accountType: 'asset',
  name: 'Bank',
  description: null,
  position: 1,
};

describe('inMemoryAccounts', () => {
  it('reads an empty chart for a User it holds nothing for', async () => {
    const { accounts } = inMemoryAccounts();

    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [], groups: [] }));
  });

  it('holds a User\'s Accounts with no Account groups unless it is given some', async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);
    hold(GRACE_ID, [CASH], [BANK]);

    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [CASH], groups: [] }));
    expect(await accounts.readChart(GRACE_ID)).toEqual(ok({ accounts: [CASH], groups: [BANK] }));
  });

  it('answers how Entries name an Account, shown over hidden, and only to its own User', async () => {
    const { accounts, hold, hideInEntry, showInEntry } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);
    hold(GRACE_ID, [{ ...CASH, id: '01920000-0000-7000-8000-000000000002' as AccountId }]);

    expect(await accounts.readNaming(ADA_ID, CASH.id)).toEqual(ok('unnamed'));
    hideInEntry(CASH.id);
    expect(await accounts.readNaming(ADA_ID, CASH.id)).toEqual(ok('hidden'));
    showInEntry(CASH.id, '2026-09-15');
    expect(await accounts.readNaming(ADA_ID, CASH.id)).toEqual(ok('shown'));
    expect(await accounts.readNaming(GRACE_ID, CASH.id)).toEqual(ok('unnamed'));
  });

  it('answers the first and last day shown Entries name an Account on, only to its own User', async () => {
    const { accounts, hold, showInEntry } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);

    expect(await accounts.readShownSpan(ADA_ID, CASH.id)).toEqual(ok(null));
    showInEntry(CASH.id, '2026-09-15');
    showInEntry(CASH.id, '2026-09-10');
    showInEntry(CASH.id, '2026-09-20');
    showInEntry(CASH.id, '2026-09-12');

    expect(await accounts.readShownSpan(ADA_ID, CASH.id)).toEqual(
      ok({ first: '2026-09-10', last: '2026-09-20' }),
    );
    expect(await accounts.readShownSpan(GRACE_ID, CASH.id)).toEqual(ok(null));
  });

  it("deletes an Account and an Account group from their User's chart alone", async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [CASH], [BANK]);
    hold(GRACE_ID, [CASH], [BANK]);

    expect(await accounts.deleteAccount(ADA_ID, CASH.id)).toEqual(ok(undefined));
    expect(await accounts.deleteGroup(ADA_ID, BANK.id)).toEqual(ok(undefined));

    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [], groups: [] }));
    expect(await accounts.readChart(GRACE_ID)).toEqual(ok({ accounts: [CASH], groups: [BANK] }));
  });

  it("marks an Account removed in its User's chart alone, at the moment given, and drops it from the chart", async () => {
    const { accounts, hold, removedAt } = inMemoryAccounts();
    const moment = new Date('2026-10-14T02:00:00Z');
    hold(ADA_ID, [CASH], [BANK]);
    hold(GRACE_ID, [], [BANK]);

    expect(await accounts.markAccountRemoved(GRACE_ID, CASH.id, moment)).toEqual(ok(undefined));
    expect(removedAt(CASH.id)).toBeUndefined();
    expect(await accounts.markAccountRemoved(ADA_ID, CASH.id, moment)).toEqual(ok(undefined));

    expect(removedAt(CASH.id)).toEqual(moment);
    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [], groups: [BANK] }));
  });

  it("places Accounts and Account groups in their User's chart alone, leaving the rest where they were", async () => {
    const { accounts, hold } = inMemoryAccounts();
    const wallet = { ...CASH, id: '01920000-0000-7000-8000-000000000002' as AccountId, name: 'Wallet' };
    hold(ADA_ID, [CASH, wallet], [BANK]);
    hold(GRACE_ID, [CASH], [BANK]);
    const banked = { ...CASH, groupId: BANK.id, position: 3 };
    const first = { ...BANK, position: 0 };

    expect(await accounts.placeNodes(ADA_ID, { accounts: [banked], groups: [first] })).toEqual(
      ok(undefined),
    );

    expect(await accounts.readChart(ADA_ID)).toEqual(
      ok({ accounts: [banked, wallet], groups: [first] }),
    );
    expect(await accounts.readChart(GRACE_ID)).toEqual(ok({ accounts: [CASH], groups: [BANK] }));
  });
});
