import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountId,
  type AddAccountInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { createAddAccount } from './add-account';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const WALLET_ID = '01920000-0000-7000-8000-000000000100' as AccountId;

const CASH: Account = {
  id: '01920000-0000-7000-8000-000000000001' as AccountId,
  accountType: 'asset',
  name: 'Cash',
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
};

const WALLET: AddAccountInput = {
  accountType: 'asset',
  name: ' Wallet ',
  description: 'Cash I carry',
  activeFrom: '2026-10-09',
  activeUntil: null,
};

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH]);
  held.hold(GRACE_ID, [CASH]);
  return {
    ...held,
    addAccount: createAddAccount({ accounts: held.accounts, newAccountId: () => WALLET_ID }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

describe('createAddAccount', () => {
  it("adds an Account at the end of its Account type in the signed-in User's chart, and answers with it", async () => {
    const { addAccount, getChart } = useCases();
    const wallet: Account = {
      id: WALLET_ID,
      accountType: 'asset',
      name: 'Wallet',
      description: 'Cash I carry',
      position: 1,
      activeFrom: '2026-10-09',
      activeUntil: null,
    };

    expect(await addAccount(ADA, WALLET)).toEqual(ok(wallet));
    expect(await getChart(ADA)).toEqual(ok([CASH, wallet]));
  });

  it("leaves another User's chart untouched", async () => {
    const { addAccount, getChart } = useCases();

    await addAccount(ADA, WALLET);

    expect(await getChart(GRACE)).toEqual(ok([CASH]));
  });

  it("refuses a name another of the User's Accounts has as taken, and adds nothing", async () => {
    const { addAccount, getChart } = useCases();

    const added = await addAccount(ADA, { ...WALLET, name: 'CASH' });

    expect(!added.ok && added.error.code).toBe('NAME_TAKEN');
    expect(await getChart(ADA)).toEqual(ok([CASH]));
  });

  it('refuses a name broken by the name rules as invalid, and adds nothing', async () => {
    const { addAccount, getChart } = useCases();

    const added = await addAccount(ADA, { ...WALLET, name: '  ' });

    expect(!added.ok && added.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(ok([CASH]));
  });

  it('refuses to add an Account for nobody, as unauthenticated', async () => {
    const { addAccount, getChart } = useCases();

    const added = await addAccount(SIGNED_OUT, WALLET);

    expect(!added.ok && added.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(ok([CASH]));
  });

  it('reports a failed read of the chart as its own result, and adds nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const addAccount = createAddAccount({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
      newAccountId: () => WALLET_ID,
    });

    expect(await addAccount(ADA, WALLET)).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(ok([CASH]));
  });

  it('reports a failed save as its own result, rather than the Account it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const addAccount = createAddAccount({
      accounts: { ...accounts, addAccount: () => Promise.resolve(err(down)) },
      newAccountId: () => WALLET_ID,
    });

    expect(await addAccount(ADA, WALLET)).toEqual(err(down));
  });
});
