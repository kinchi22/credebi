import { type DeleteAccountInput, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { removedAccount } from '../domain/removal';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type DeleteAccountDependencies = {
  readonly accounts: AccountRepository;
  readonly now: () => Date;
};

export type DeleteAccount = (
  auth: AuthContext,
  input: DeleteAccountInput,
) => Promise<Result<Account, DomainError>>;

export function createDeleteAccount({ accounts, now }: DeleteAccountDependencies): DeleteAccount {
  return async (auth, { id }) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const naming = await accounts.readNaming(userId.value, id);
    if (!naming.ok) {
      return naming;
    }

    return changeChart(
      accounts,
      auth,
      (chart) => removedAccount(chart, id, naming.value),
      (owner, account) =>
        naming.value === 'hidden'
          ? accounts.markAccountRemoved(owner, account.id, now())
          : accounts.deleteAccount(owner, account.id),
    );
  };
}
