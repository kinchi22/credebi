import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type EditAccountGroupInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup } from '../domain/account';
import { createEditAccountGroup } from './edit-account-group';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const group = (n: number, accountType: AccountGroup['accountType'], name: string, position: number): AccountGroup => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId,
  accountType,
  name,
  description: null,
  position,
});

const BANK = group(1, 'asset', 'Bank', 0);
const SAVINGS = group(2, 'asset', 'Savings', 1);
const LOANS = group(3, 'liability', 'Loans', 0);
const GRACES_BANK = group(4, 'asset', 'Bank', 0);

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

const renamed = (fields: Partial<EditAccountGroupInput> = {}): EditAccountGroupInput => ({
  id: BANK.id,
  name: ' Banks ',
  description: 'Current accounts',
  ...fields,
});

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [ABC_BANK], [BANK, SAVINGS, LOANS]);
  held.hold(GRACE_ID, [], [GRACES_BANK]);
  return {
    ...held,
    editAccountGroup: createEditAccountGroup({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const chartWith = (bank: AccountGroup) =>
  ok([
    { kind: 'group', group: bank, accounts: [ABC_BANK] },
    { kind: 'group', group: SAVINGS, accounts: [] },
    { kind: 'group', group: LOANS, accounts: [] },
  ]);

describe('createEditAccountGroup', () => {
  it("changes an Account group's name and description, keeps its Accounts and place, and answers with it", async () => {
    const { editAccountGroup, getChart } = useCases();
    const banks = { ...BANK, name: 'Banks', description: 'Current accounts' };

    expect(await editAccountGroup(ADA, renamed())).toEqual(ok(banks));
    expect(await getChart(ADA)).toEqual(chartWith(banks));
  });

  it('refuses a name another Account group of its Account type has as taken, and changes nothing', async () => {
    const { editAccountGroup, getChart } = useCases();

    const edited = await editAccountGroup(ADA, renamed({ name: 'savings' }));

    expect(!edited.ok && edited.error.code).toBe('NAME_TAKEN');
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it('takes a name an Account group of another Account type has', async () => {
    const { editAccountGroup } = useCases();

    const edited = await editAccountGroup(ADA, renamed({ name: 'Loans' }));

    expect(edited.ok && edited.value.name).toBe('Loans');
  });

  it('refuses a name broken by the name rules as invalid, and changes nothing', async () => {
    const { editAccountGroup, getChart } = useCases();

    const edited = await editAccountGroup(ADA, renamed({ name: ' ' }));

    expect(!edited.ok && edited.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it("refuses another User's Account group as not found, and leaves it untouched", async () => {
    const { editAccountGroup, getChart } = useCases();

    const edited = await editAccountGroup(ADA, renamed({ id: GRACES_BANK.id }));

    expect(!edited.ok && edited.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok([{ kind: 'group', group: GRACES_BANK, accounts: [] }]));
  });

  it('refuses to edit an Account group for nobody, as unauthenticated', async () => {
    const { editAccountGroup, getChart } = useCases();

    const edited = await editAccountGroup(SIGNED_OUT, renamed());

    expect(!edited.ok && edited.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it('reports a failed read of the chart as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const editAccountGroup = createEditAccountGroup({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await editAccountGroup(ADA, renamed())).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(chartWith(BANK));
  });

  it('reports a failed save as its own result, rather than the Account group it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const editAccountGroup = createEditAccountGroup({
      accounts: { ...accounts, updateGroup: () => Promise.resolve(err(down)) },
    });

    expect(await editAccountGroup(ADA, renamed())).toEqual(err(down));
  });
});
