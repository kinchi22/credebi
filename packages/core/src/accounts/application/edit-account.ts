import { type DomainError, type EditAccountInput, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { editedAccount } from '../domain/account-details';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type EditAccountDependencies = {
  readonly accounts: AccountRepository;
};

export type EditAccount = (
  auth: AuthContext,
  input: EditAccountInput,
) => Promise<Result<Account, DomainError>>;

export function createEditAccount({ accounts }: EditAccountDependencies): EditAccount {
  return (auth, { id, ...details }) =>
    changeChart(
      accounts,
      auth,
      (chart) => editedAccount(chart, id, details),
      accounts.updateAccount,
    );
}
