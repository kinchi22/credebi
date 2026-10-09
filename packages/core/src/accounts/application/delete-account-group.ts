import { type DeleteAccountGroupInput, type DomainError, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type AccountGroup } from '../domain/account';
import { removedGroup } from '../domain/removal';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type DeleteAccountGroupDependencies = {
  readonly accounts: AccountRepository;
};

export type DeleteAccountGroup = (
  auth: AuthContext,
  input: DeleteAccountGroupInput,
) => Promise<Result<AccountGroup, DomainError>>;

export function createDeleteAccountGroup({
  accounts,
}: DeleteAccountGroupDependencies): DeleteAccountGroup {
  return (auth, { id }) =>
    changeChart(
      accounts,
      auth,
      (chart) => removedGroup(chart, id),
      (userId, group) => accounts.deleteGroup(userId, group.id),
    );
}
