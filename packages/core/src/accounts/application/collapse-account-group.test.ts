import { describe, expect, it } from 'vitest';
import { domainError, err, ok, type AccountGroupId, type AccountId, type UserId } from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup } from '../domain/account';
import { createCollapseAccountGroup } from './collapse-account-group';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const group = (n: number, name: string, position: number): AccountGroup => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId,
  accountType: 'asset',
  name,
  description: null,
  position,
  collapsed: false,
});

const BANK = group(1, 'Bank', 0);
const SAVINGS = group(2, 'Savings', 1);
const GRACES_BANK = group(3, 'Bank', 0);

const ABC_BANK: Account = {
  id: '01920000-0000-7000-8000-000000000a0b' as AccountId,
  accountType: 'asset',
  groupId: BANK.id,
  name: 'ABC Bank',
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
};

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [ABC_BANK], [BANK, SAVINGS]);
  held.hold(GRACE_ID, [], [GRACES_BANK]);
  return {
    ...held,
    collapseAccountGroup: createCollapseAccountGroup({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const chartWith = (bank: AccountGroup) =>
  ok([
    { kind: 'group', group: bank, accounts: [ABC_BANK] },
    { kind: 'group', group: SAVINGS, accounts: [] },
  ]);

describe('createCollapseAccountGroup', () => {
  it("collapses a User's Account group, keeping its Accounts and place and every other group as it was, and answers with it", async () => {
    const { collapseAccountGroup, getChart } = useCases();
    const collapsed = { ...BANK, collapsed: true };

    expect(await collapseAccountGroup(ADA, { id: BANK.id, collapsed: true })).toEqual(ok(collapsed));
    expect(await getChart(ADA)).toEqual(chartWith(collapsed));
  });

  it('expands a collapsed Account group again', async () => {
    const { collapseAccountGroup, getChart } = useCases();
    await collapseAccountGroup(ADA, { id: BANK.id, collapsed: true });

    expect(await collapseAccountGroup(ADA, { id: BANK.id, collapsed: false })).toEqual(ok(BANK));
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it("refuses another User's Account group as not found, and leaves it expanded", async () => {
    const { collapseAccountGroup, getChart } = useCases();

    const collapsed = await collapseAccountGroup(ADA, { id: GRACES_BANK.id, collapsed: true });

    expect(!collapsed.ok && collapsed.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok([{ kind: 'group', group: GRACES_BANK, accounts: [] }]));
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it('refuses to collapse an Account group for nobody, as unauthenticated', async () => {
    const { collapseAccountGroup, getChart } = useCases();

    const collapsed = await collapseAccountGroup(SIGNED_OUT, { id: BANK.id, collapsed: true });

    expect(!collapsed.ok && collapsed.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it('reports a failed save as its own result, rather than the Account group it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const collapseAccountGroup = createCollapseAccountGroup({
      accounts: { ...accounts, collapseGroup: () => Promise.resolve(err(down)) },
    });

    expect(await collapseAccountGroup(ADA, { id: BANK.id, collapsed: true })).toEqual(err(down));
  });
});
