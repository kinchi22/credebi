import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup } from '../domain/account';
import { createDeleteAccountGroup } from './delete-account-group';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const group = (n: number, name: string, position: number): AccountGroup => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId,
  accountType: 'liability',
  name,
  description: null,
  position,
});

const LOANS = group(1, 'Loans', 1);
const CARDS = group(2, 'Cards', 2);
const GRACES_LOANS = group(3, 'Loans', 0);

const VISA: Account = {
  id: '01920000-0000-7000-8000-000000000a01' as AccountId,
  accountType: 'liability',
  groupId: CARDS.id,
  name: 'Visa',
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
};

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [VISA], [LOANS, CARDS]);
  held.hold(GRACE_ID, [], [GRACES_LOANS]);
  return {
    ...held,
    deleteAccountGroup: createDeleteAccountGroup({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const UNCHANGED = ok([
  { kind: 'group', group: LOANS, accounts: [] },
  { kind: 'group', group: CARDS, accounts: [VISA] },
]);

describe('createDeleteAccountGroup', () => {
  it('deletes an empty Account group, answers with it, and leaves the rest of the chart', async () => {
    const { deleteAccountGroup, getChart } = useCases();

    expect(await deleteAccountGroup(ADA, { id: LOANS.id })).toEqual(ok(LOANS));
    expect(await getChart(ADA)).toEqual(ok([{ kind: 'group', group: CARDS, accounts: [VISA] }]));
  });

  it('refuses an Account group that holds an Account as in use, and changes nothing', async () => {
    const { deleteAccountGroup, getChart } = useCases();

    const deleted = await deleteAccountGroup(ADA, { id: CARDS.id });

    expect(!deleted.ok && deleted.error.code).toBe('IN_USE');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it("refuses another User's Account group as not found, and leaves it untouched", async () => {
    const { deleteAccountGroup, getChart } = useCases();

    const deleted = await deleteAccountGroup(ADA, { id: GRACES_LOANS.id });

    expect(!deleted.ok && deleted.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok([{ kind: 'group', group: GRACES_LOANS, accounts: [] }]));
  });

  it('refuses to delete an Account group for nobody, as unauthenticated', async () => {
    const { deleteAccountGroup, getChart } = useCases();

    const deleted = await deleteAccountGroup(SIGNED_OUT, { id: LOANS.id });

    expect(!deleted.ok && deleted.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed read of the chart as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const deleteAccountGroup = createDeleteAccountGroup({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await deleteAccountGroup(ADA, { id: LOANS.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed delete as its own result, rather than the Account group it could not delete', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const deleteAccountGroup = createDeleteAccountGroup({
      accounts: { ...accounts, deleteGroup: () => Promise.resolve(err(down)) },
    });

    expect(await deleteAccountGroup(ADA, { id: LOANS.id })).toEqual(err(down));
  });
});
