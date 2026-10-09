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

  it('answers that an Account is named only once an Entry names it, and only to its own User', async () => {
    const { accounts, hold, nameInEntry } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);

    expect(await accounts.isAccountNamed(ADA_ID, CASH.id)).toEqual(ok(false));
    nameInEntry(CASH.id);
    expect(await accounts.isAccountNamed(ADA_ID, CASH.id)).toEqual(ok(true));
    expect(await accounts.isAccountNamed(GRACE_ID, CASH.id)).toEqual(ok(false));
  });

  it('answers the first and last day shown Entries name an Account on, only to its own User, and counts it as named', async () => {
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
    expect(await accounts.isAccountNamed(ADA_ID, CASH.id)).toEqual(ok(true));
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
});
