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
});
