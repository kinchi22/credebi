import { describe, expect, it } from 'vitest';
import { domainError, err, ok, type AccountId, type UserId } from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const account = (
  n: number,
  accountType: Account['accountType'],
  position: number,
  name: string,
): Account => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId,
  accountType,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const RENT = account(1, 'expense', 1, 'Rent');
const EXPENSES = account(2, 'expense', 0, 'Expenses');
const CASH = account(3, 'asset', 0, 'Cash');
const WALLET = account(4, 'asset', 0, 'Wallet');

describe('createGetChart', () => {
  it("lists the signed-in User's chart of accounts in order", async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [RENT, EXPENSES, CASH]);
    const getChart = createGetChart({ accounts });

    expect(await getChart(ADA)).toEqual(ok([CASH, EXPENSES, RENT]));
  });

  it("never lists another User's Accounts", async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);
    hold(GRACE_ID, [WALLET]);
    const getChart = createGetChart({ accounts });

    expect(await getChart(ADA)).toEqual(ok([CASH]));
    expect(await getChart(GRACE)).toEqual(ok([WALLET]));
  });

  it('lists an empty chart for a User who holds no Accounts', async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(GRACE_ID, [WALLET]);
    const getChart = createGetChart({ accounts });

    expect(await getChart(ADA)).toEqual(ok([]));
  });

  it('refuses to list a chart for nobody, as unauthenticated', async () => {
    const { accounts, hold } = inMemoryAccounts();
    hold(ADA_ID, [CASH]);
    const getChart = createGetChart({ accounts });

    const chart = await getChart(SIGNED_OUT);

    expect(!chart.ok && chart.error.code).toBe('UNAUTHENTICATED');
  });

  it('reports a failed read as its own result', async () => {
    const unavailable: AccountRepository = {
      ...inMemoryAccounts().accounts,
      readChart: () =>
        Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
    };
    const getChart = createGetChart({ accounts: unavailable });

    const chart = await getChart(ADA);

    expect(!chart.ok && chart.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
