import { ok, type DeleteAccountInput, type DomainError, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { findAccount, type Account } from '../domain/account';
import { accountInUse } from '../domain/removal';
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
  return (auth, { id }) =>
    changeChart(
      accounts,
      auth,
      (chart) => findAccount(chart, id),
      async (owner, account) => {
        const removal = await accounts.removeAccount(owner, account.id, now());
        if (!removal.ok) {
          return removal;
        }
        return removal.value === 'refused' ? accountInUse(account) : ok(undefined);
      },
    );
}
