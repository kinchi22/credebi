import { type DeleteAccountInput, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { removedAccount } from '../domain/removal';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type DeleteAccountDependencies = {
  readonly accounts: AccountRepository;
};

export type DeleteAccount = (
  auth: AuthContext,
  input: DeleteAccountInput,
) => Promise<Result<Account, DomainError>>;

export function createDeleteAccount({ accounts }: DeleteAccountDependencies): DeleteAccount {
  return async (auth, { id }) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const named = await accounts.isAccountNamed(userId.value, id);
    if (!named.ok) {
      return named;
    }

    return changeChart(
      accounts,
      auth,
      (chart) => removedAccount(chart, id, named.value),
      (owner, account) => accounts.deleteAccount(owner, account.id),
    );
  };
}
