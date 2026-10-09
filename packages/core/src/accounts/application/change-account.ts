import { ok, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export async function changeAccount(
  accounts: AccountRepository,
  auth: AuthContext,
  change: (chart: readonly Account[]) => Result<Account, DomainError>,
  save: 'addAccount' | 'updateAccount',
): Promise<Result<Account, DomainError>> {
  const userId = requireUser(auth);
  if (!userId.ok) {
    return userId;
  }

  const chart = await accounts.readChart(userId.value);
  if (!chart.ok) {
    return chart;
  }

  const account = change(chart.value);
  if (!account.ok) {
    return account;
  }

  const saved = await accounts[save](userId.value, account.value);
  return saved.ok ? ok(account.value) : saved;
}
