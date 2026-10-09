import {
  type AccountGroupId,
  type AddAccountGroupInput,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type AccountGroup } from '../domain/account';
import { addedGroup } from '../domain/account-details';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type AddAccountGroupDependencies = {
  readonly accounts: AccountRepository;
  readonly newAccountGroupId: () => AccountGroupId;
};

export type AddAccountGroup = (
  auth: AuthContext,
  input: AddAccountGroupInput,
) => Promise<Result<AccountGroup, DomainError>>;

export function createAddAccountGroup({
  accounts,
  newAccountGroupId,
}: AddAccountGroupDependencies): AddAccountGroup {
  return (auth, { accountType, ...details }) =>
    changeChart(
      accounts,
      auth,
      (chart) => addedGroup(chart, accountType, details, newAccountGroupId()),
      accounts.addGroup,
    );
}
