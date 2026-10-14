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

  it("removes an Account by how Entries name it: refused while shown, marked at the moment given while only hidden, else deleted", async () => {
    const { accounts, hold, hideInEntry, showInEntry, removedAt } = inMemoryAccounts();
    const moment = new Date('2026-10-14T02:00:00Z');
    const wallet = { ...CASH, id: '01920000-0000-7000-8000-000000000002' as AccountId, name: 'Wallet' };
    const float = { ...CASH, id: '01920000-0000-7000-8000-000000000003' as AccountId, name: 'Float' };
    hold(ADA_ID, [CASH, wallet, float], [BANK]);
    showInEntry(CASH.id, '2026-09-15');
    hideInEntry(CASH.id);
    hideInEntry(float.id);

    expect(await accounts.removeAccount(ADA_ID, CASH.id, moment)).toEqual(ok('refused'));
    expect(await accounts.removeAccount(ADA_ID, float.id, moment)).toEqual(ok('marked'));
    expect(await accounts.removeAccount(ADA_ID, wallet.id, moment)).toEqual(ok('deleted'));

    expect(removedAt(CASH.id)).toBeUndefined();
    expect(removedAt(float.id)).toEqual(moment);
    expect(removedAt(wallet.id)).toBeUndefined();
    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [CASH], groups: [BANK] }));
  });

  it("refuses to remove an Account outside its User's chart as not found, and leaves it", async () => {
    const { accounts, hold, hideInEntry, removedAt } = inMemoryAccounts();
    const safe = { ...CASH, id: '01920000-0000-7000-8000-000000000004' as AccountId, name: 'Safe' };
    hold(ADA_ID, [CASH]);
    hold(GRACE_ID, [safe]);
    hideInEntry(CASH.id);

    const removed = await accounts.removeAccount(GRACE_ID, CASH.id, new Date());

    expect(!removed.ok && removed.error).toEqual({
      code: 'NOT_FOUND',
      message: `Account ${CASH.id} is not in the User's chart of accounts.`,
    });
    expect(removedAt(CASH.id)).toBeUndefined();
    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [CASH], groups: [] }));
  });

  it("deletes an Account group from its User's chart alone", async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [CASH], [BANK]);
    hold(GRACE_ID, [CASH], [BANK]);

    expect(await accounts.deleteGroup(ADA_ID, BANK.id)).toEqual(ok(undefined));

    expect(await accounts.readChart(ADA_ID)).toEqual(ok({ accounts: [CASH], groups: [] }));
    expect(await accounts.readChart(GRACE_ID)).toEqual(ok({ accounts: [CASH], groups: [BANK] }));
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
