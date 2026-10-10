import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type AddAccountGroupInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup } from '../domain/account';
import { createAddAccountGroup } from './add-account-group';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const NEW_ID = '01920000-0000-7000-8000-000000000b99' as AccountGroupId;

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

const LOANS: AccountGroup = {
  id: '01920000-0000-7000-8000-000000000b01' as AccountGroupId,
  accountType: 'liability',
  name: 'Loans',
  description: null,
  position: 0,
};

const BANK: AddAccountGroupInput = {
  accountType: 'asset',
  name: ' Bank ',
  description: 'Accounts at a bank',
};

const ADDED: AccountGroup = {
  id: NEW_ID,
  accountType: 'asset',
  name: 'Bank',
  description: 'Accounts at a bank',
  position: 1,
};

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH], [LOANS]);
  held.hold(GRACE_ID, [CASH]);
  return {
    ...held,
    addAccountGroup: createAddAccountGroup({
      accounts: held.accounts,
      newAccountGroupId: () => NEW_ID,
    }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const UNCHANGED = ok([
  { kind: 'account', account: CASH },
  { kind: 'group', group: LOANS, accounts: [] },
]);

describe('createAddAccountGroup', () => {
  it("adds an Account group at the end of its Account type in the signed-in User's chart, and answers with it", async () => {
    const { addAccountGroup, getChart } = useCases();

    expect(await addAccountGroup(ADA, BANK)).toEqual(ok(ADDED));
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: CASH },
        { kind: 'group', group: ADDED, accounts: [] },
        { kind: 'group', group: LOANS, accounts: [] },
      ]),
    );
  });

  it("leaves another User's chart untouched", async () => {
    const { addAccountGroup, getChart } = useCases();

    await addAccountGroup(ADA, BANK);

    expect(await getChart(GRACE)).toEqual(ok([{ kind: 'account', account: CASH }]));
  });

  it('refuses a name another Account group of its Account type has as taken, ignoring case, and adds nothing', async () => {
    const { addAccountGroup, getChart } = useCases();

    const added = await addAccountGroup(ADA, { ...BANK, accountType: 'liability', name: 'LOANS' });

    expect(!added.ok && added.error.code).toBe('NAME_TAKEN');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('refuses a name broken by the name rules as invalid, and adds nothing', async () => {
    const { addAccountGroup, getChart } = useCases();

    const added = await addAccountGroup(ADA, { ...BANK, name: '' });

    expect(!added.ok && added.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('refuses to add an Account group for nobody, as unauthenticated', async () => {
    const { addAccountGroup, getChart } = useCases();

    const added = await addAccountGroup(SIGNED_OUT, BANK);

    expect(!added.ok && added.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed read of the chart as its own result, and adds nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const addAccountGroup = createAddAccountGroup({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
      newAccountGroupId: () => NEW_ID,
    });

    expect(await addAccountGroup(ADA, BANK)).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNCHANGED);
  });

  it('reports a failed save as its own result, rather than the Account group it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const addAccountGroup = createAddAccountGroup({
      accounts: { ...accounts, addGroup: () => Promise.resolve(err(down)) },
      newAccountGroupId: () => NEW_ID,
    });

    expect(await addAccountGroup(ADA, BANK)).toEqual(err(down));
  });
});
