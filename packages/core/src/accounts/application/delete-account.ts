import { type DeleteAccountInput, type DomainError, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
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
  return (auth, { id }) =>
    changeChart(
      accounts,
      auth,
      async (chart, userId) => {
        const named = await accounts.isAccountNamed(userId, id);
        return named.ok ? removedAccount(chart, id, named.value) : named;
      },
      (userId, account) => accounts.deleteAccount(userId, account.id),
    );
}
