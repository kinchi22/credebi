import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type EditAccountInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup, type ChartNode } from '../domain/account';
import { createEditAccount } from './edit-account';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const account = (n: number, accountType: Account['accountType'], name: string): Account => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId,
  accountType,
  groupId: null,
  name,
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
});


const ungrouped = (...accounts: Account[]): readonly ChartNode[] =>
  accounts.map((account) => ({ kind: 'account', account }));

const CASH = account(1, 'asset', 'Cash');
const SALES = account(2, 'revenue', 'Sales');
const GRACES_SAFE = account(3, 'asset', 'Safe');

const renamed = (fields: Partial<EditAccountInput> = {}): EditAccountInput => ({
  id: CASH.id,
  name: 'Wallet',
  description: 'Cash I carry',
  groupId: null,
  activeFrom: '2026-08-01',
  activeUntil: '2026-12-31',
  ...fields,
});

const group = (n: number, accountType: AccountGroup['accountType'], name: string): AccountGroup => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId,
  accountType,
  name,
  description: null,
  position: 1,
});

const BANK = group(11, 'asset', 'Bank');
const SAVINGS = group(12, 'asset', 'Savings');
const TAKINGS = group(13, 'revenue', 'Takings');
const GRACES_BANK = group(14, 'asset', 'Bank');

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH, SALES]);
  held.hold(GRACE_ID, [GRACES_SAFE]);
  return {
    ...held,
    editAccount: createEditAccount({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

describe('createEditAccount', () => {
  it("changes an Account's name, description and Active period in the signed-in User's chart, and answers with it", async () => {
    const { editAccount, getChart } = useCases();
    const wallet: Account = {
      ...CASH,
      name: 'Wallet',
      description: 'Cash I carry',
      activeFrom: '2026-08-01',
      activeUntil: '2026-12-31',
    };

    expect(await editAccount(ADA, renamed())).toEqual(ok(wallet));
    expect(await getChart(ADA)).toEqual(ok(ungrouped(wallet, SALES)));
  });

  it("refuses a name another of the User's Accounts has as taken, and changes nothing", async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ name: 'sales' }));

    expect(!edited.ok && edited.error.code).toBe('NAME_TAKEN');
    expect(await getChart(ADA)).toEqual(ok(ungrouped(CASH, SALES)));
  });

  it("refuses another User's Account as not found, and leaves it untouched", async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ id: GRACES_SAFE.id }));

    expect(!edited.ok && edited.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok(ungrouped(GRACES_SAFE)));
  });

  it('refuses an Active period that ends before it starts, and changes nothing', async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ activeUntil: '2026-07-31' }));

    expect(!edited.ok && edited.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(ok(ungrouped(CASH, SALES)));
  });

  it('moves an Account into, between and out of Account groups of its Account type, last in each list', async () => {
    const { editAccount, getChart, hold } = useCases();
    const abcBank = { ...account(4, 'asset', 'ABC Bank'), groupId: BANK.id };
    hold(ADA_ID, [CASH, abcBank, SALES], [BANK, SAVINGS, TAKINGS]);
    const cash = (groupId: AccountGroupId | null, position: number): Account => ({
      ...CASH,
      ...renamed({ name: 'Cash', groupId }),
      position,
    });

    expect(await editAccount(ADA, renamed({ name: 'Cash', groupId: BANK.id }))).toEqual(
      ok(cash(BANK.id, 1)),
    );
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'group', group: BANK, accounts: [abcBank, cash(BANK.id, 1)] },
        { kind: 'group', group: SAVINGS, accounts: [] },
        { kind: 'account', account: SALES },
        { kind: 'group', group: TAKINGS, accounts: [] },
      ]),
    );

    await editAccount(ADA, renamed({ name: 'Cash', groupId: SAVINGS.id }));
    await editAccount(ADA, renamed({ name: 'Cash', groupId: null }));

    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'group', group: BANK, accounts: [abcBank] },
        { kind: 'group', group: SAVINGS, accounts: [] },
        { kind: 'account', account: cash(null, 2) },
        { kind: 'account', account: SALES },
        { kind: 'group', group: TAKINGS, accounts: [] },
      ]),
    );
  });

  it("refuses an Account group of another Account type, or another User's, and moves nothing", async () => {
    const { editAccount, getChart, hold } = useCases();
    hold(ADA_ID, [CASH, SALES], [TAKINGS]);
    hold(GRACE_ID, [GRACES_SAFE], [GRACES_BANK]);

    const otherType = await editAccount(ADA, renamed({ groupId: TAKINGS.id }));
    const otherUser = await editAccount(ADA, renamed({ groupId: GRACES_BANK.id }));

    expect(!otherType.ok && otherType.error.code).toBe('INVALID_INPUT');
    expect(!otherUser.ok && otherUser.error.code).toBe('NOT_FOUND');
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: CASH },
        { kind: 'account', account: SALES },
        { kind: 'group', group: TAKINGS, accounts: [] },
      ]),
    );
  });

  it('refuses to edit an Account for nobody, as unauthenticated', async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(SIGNED_OUT, renamed());

    expect(!edited.ok && edited.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(ok(ungrouped(CASH, SALES)));
  });

  it('reports a failed read of the chart as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const editAccount = createEditAccount({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await editAccount(ADA, renamed())).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(ok(ungrouped(CASH, SALES)));
  });

  it('reports a failed save as its own result, rather than the Account it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const editAccount = createEditAccount({
      accounts: { ...accounts, updateAccount: () => Promise.resolve(err(down)) },
    });

    expect(await editAccount(ADA, renamed())).toEqual(err(down));
  });
});
