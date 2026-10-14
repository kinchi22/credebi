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
import { createAddAccount } from './add-account';
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
const FLOAT = account(5, 'Float', 2);
const BANK_FLOAT = { ...account(6, 'Bank float', 1), groupId: BANK.id };
const NEW_FLOAT_ID = '01920000-0000-7000-8000-000000000007' as AccountId;

const NOW = new Date('2026-10-14T02:00:00Z');

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH, PETTY_CASH, ABC_BANK], [BANK]);
  held.hold(GRACE_ID, [SAFE]);
  held.showInEntry(CASH.id, '2026-09-15');
  return {
    ...held,
    deleteAccount: createDeleteAccount({ accounts: held.accounts, now: () => NOW }),
    getChart: createGetChart({ accounts: held.accounts }),
    addAccount: createAddAccount({ accounts: held.accounts, newAccountId: () => NEW_FLOAT_ID }),
  };
}

const UNCHANGED = ok([
  { kind: 'account', account: CASH },
  { kind: 'account', account: PETTY_CASH },
  { kind: 'group', group: BANK, accounts: [ABC_BANK] },
]);

describe('createDeleteAccount', () => {
  it('deletes an Account no Entry line names, answers with it, and leaves the rest of the chart', async () => {
    const { deleteAccount, getChart, removedAt } = useCases();

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(ok(PETTY_CASH));
    expect(removedAt(PETTY_CASH.id)).toBeUndefined();
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

  it('refuses an Account a shown Entry names as in use, and changes nothing', async () => {
    const { deleteAccount, getChart, hideInEntry } = useCases();
    hideInEntry(CASH.id);

    const deleted = await deleteAccount(ADA, { id: CASH.id });

    expect(!deleted.ok && deleted.error.code).toBe('IN_USE');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('marks an Account only hidden Reversal pairs name removed at this moment, answers with it, and drops it from the chart and its Account group', async () => {
    const { deleteAccount, getChart, hideInEntry, hold, removedAt } = useCases();
    hold(ADA_ID, [CASH, BANK_FLOAT, ABC_BANK, FLOAT], [BANK]);
    hideInEntry(FLOAT.id);
    hideInEntry(BANK_FLOAT.id);

    expect(await deleteAccount(ADA, { id: FLOAT.id })).toEqual(ok(FLOAT));
    expect(await deleteAccount(ADA, { id: BANK_FLOAT.id })).toEqual(ok(BANK_FLOAT));

    expect(removedAt(FLOAT.id)).toEqual(NOW);
    expect(removedAt(BANK_FLOAT.id)).toEqual(NOW);
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: CASH },
        { kind: 'group', group: BANK, accounts: [ABC_BANK] },
      ]),
    );
  });

  it('frees the name of an Account it marks removed for a new Account, ignoring case', async () => {
    const { addAccount, deleteAccount, hideInEntry, hold } = useCases();
    hold(ADA_ID, [CASH, FLOAT]);
    hideInEntry(FLOAT.id);

    await deleteAccount(ADA, { id: FLOAT.id });
    const added = await addAccount(ADA, {
      accountType: 'asset',
      name: 'FLOAT',
      description: '',
      groupId: null,
      activeFrom: '2026-10-14',
      activeUntil: null,
    });

    expect(added.ok && added.value.id).toBe(NEW_FLOAT_ID);
  });

  it('refuses an Account it has already marked removed as not found', async () => {
    const { deleteAccount, hideInEntry, hold } = useCases();
    hold(ADA_ID, [CASH, FLOAT]);
    hideInEntry(FLOAT.id);

    await deleteAccount(ADA, { id: FLOAT.id });
    const again = await deleteAccount(ADA, { id: FLOAT.id });

    expect(!again.ok && again.error.code).toBe('NOT_FOUND');
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
      now: () => NOW,
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed answer to how Entries name the Account as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, readNaming: () => Promise.resolve(err(down)) },
      now: () => NOW,
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed delete as its own result, rather than the Account it could not delete', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, deleteAccount: () => Promise.resolve(err(down)) },
      now: () => NOW,
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
  });

  it('reports a failed mark as removed as its own result, rather than the Account it could not remove', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart, hideInEntry } = useCases();
    hideInEntry(PETTY_CASH.id);
    const deleteAccount = createDeleteAccount({
      accounts: { ...accounts, markAccountRemoved: () => Promise.resolve(err(down)) },
      now: () => NOW,
    });

    expect(await deleteAccount(ADA, { id: PETTY_CASH.id })).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });
});
