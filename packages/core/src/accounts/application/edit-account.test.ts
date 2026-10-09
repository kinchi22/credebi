import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountId,
  type EditAccountInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
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
  name,
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const CASH = account(1, 'asset', 'Cash');
const SALES = account(2, 'revenue', 'Sales');
const GRACES_SAFE = account(3, 'asset', 'Safe');

const renamed = (fields: Partial<EditAccountInput> = {}): EditAccountInput => ({
  id: CASH.id,
  name: 'Wallet',
  description: 'Cash I carry',
  activeFrom: '2026-08-01',
  activeUntil: '2026-12-31',
  ...fields,
});

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
    expect(await getChart(ADA)).toEqual(ok([wallet, SALES]));
  });

  it("refuses a name another of the User's Accounts has as taken, and changes nothing", async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ name: 'sales' }));

    expect(!edited.ok && edited.error.code).toBe('NAME_TAKEN');
    expect(await getChart(ADA)).toEqual(ok([CASH, SALES]));
  });

  it("refuses another User's Account as not found, and leaves it untouched", async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ id: GRACES_SAFE.id }));

    expect(!edited.ok && edited.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(ok([GRACES_SAFE]));
  });

  it('refuses an Active period that ends before it starts, and changes nothing', async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(ADA, renamed({ activeUntil: '2026-07-31' }));

    expect(!edited.ok && edited.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(ok([CASH, SALES]));
  });

  it('refuses to edit an Account for nobody, as unauthenticated', async () => {
    const { editAccount, getChart } = useCases();

    const edited = await editAccount(SIGNED_OUT, renamed());

    expect(!edited.ok && edited.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(ok([CASH, SALES]));
  });

  it('reports a failed read of the chart as its own result, and changes nothing', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const editAccount = createEditAccount({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await editAccount(ADA, renamed())).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(ok([CASH, SALES]));
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
