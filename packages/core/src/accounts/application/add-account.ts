import {
  type AccountId,
  type AddAccountInput,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { addedAccount } from '../domain/account-details';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type AddAccountDependencies = {
  readonly accounts: AccountRepository;
  readonly newAccountId: () => AccountId;
};

export type AddAccount = (
  auth: AuthContext,
  input: AddAccountInput,
) => Promise<Result<Account, DomainError>>;

export function createAddAccount({ accounts, newAccountId }: AddAccountDependencies): AddAccount {
  return (auth, { accountType, ...details }) =>
    changeChart(
      accounts,
      auth,
      (chart) => addedAccount(chart, accountType, details, newAccountId()),
      accounts.addAccount,
    );
}
