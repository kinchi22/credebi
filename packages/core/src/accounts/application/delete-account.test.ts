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
import { createDeleteAccount } from './delete-account';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const account = (n: number, name: string, position: number): Account => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId,
  accountType: 'asset',
  groupId: null,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const BANK: AccountGroup = {
  id: '01920000-0000-7000-8000-000000000b01' as AccountGroupId,
  accountType: 'asset',
  name: 'Bank',
  description: null,
  position: 2,
};

const CASH = account(1, 'Cash', 0);
const PETTY_CASH = account(2, 'Petty cash', 1);
const ABC_BANK = { ...account(3, 'ABC Bank', 0), groupId: BANK.id };
const SAFE = account(4, 'Safe', 0);

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH, PETTY_CASH, ABC_BANK], [BANK]);
  held.hold(GRACE_ID, [SAFE]);
  held.nameInEntry(CASH.id);
  return {
    ...held,
    deleteAccount: createDeleteAccount({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const UNCHANGED = ok([
  { kind: 'account', account: CASH },
  { kind: 'account', account: PETTY_CASH },
  { kind: 'group', group: BANK, accounts: [ABC_BANK] },
]);

describe('createDeleteAccount', () => {
  it('deletes an Account no Entry line names, answers with it, and leaves the rest of the chart', async () => {
    const { deleteAccount, getChart } = useCases();

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(ok(PETTY_CASH));
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: CASH },
        { kind: 'group', group: BANK, accounts: [ABC_BANK] },
      ]),
    );
  });

  it('deletes an Account from inside its Account group, and keeps the Account group', async () => {
    const { deleteAccount, getChart } = useCases();

    expect(await deleteAccount(ADA, { id: ABC_BANK.id })).toEqual(ok(ABC_BANK));
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: CASH },
        { kind: 'account', account: PETTY_CASH },
        { kind: 'group', group: BANK, accounts: [] },
      ]),
    );
  });

  it('refuses an Account an Entry line names as in use, and changes nothing', async () => {
    const { deleteAccount, getChart } = useCases();

    const deleted = await deleteAccount(ADA, { id: CASH.id });

    expect(!deleted.ok && deleted.error.code).toBe('IN_USE');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it("refuses another User's Account as not found, and leaves it untouched", async () => {
    const { deleteAccount, getChart } = useCases();

    const deleted = await deleteAccount(ADA, { id: SAFE.id });

    expect(!deleted.ok && deleted.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok([{ kind: 'account', account: SAFE }]));
  });

  it('refuses to delete an Account for nobody, as unauthenticated', async () => {
    const { deleteAccount, getChart } = useCases();

    const deleted = await deleteAccount(SIGNED_OUT, { id: PETTY_CASH.id });

    expect(!deleted.ok && deleted.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed read of the chart as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed answer to whether an Entry names the Account as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, isAccountNamed: () => Promise.resolve(err(down)) },
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed delete as its own result, rather than the Account it could not delete', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, deleteAccount: () => Promise.resolve(err(down)) },
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
  });
});
