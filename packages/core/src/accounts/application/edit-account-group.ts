import { type DomainError, type EditAccountGroupInput, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type AccountGroup } from '../domain/account';
import { editedGroup } from '../domain/account-details';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type EditAccountGroupDependencies = {
  readonly accounts: AccountRepository;
};

export type EditAccountGroup = (
  auth: AuthContext,
  input: EditAccountGroupInput,
) => Promise<Result<AccountGroup, DomainError>>;

export function createEditAccountGroup({ accounts }: EditAccountGroupDependencies): EditAccountGroup {
  return (auth, { id, ...details }) =>
    changeChart(
      accounts,
      auth,
      (chart) => editedGroup(chart, id, details),
      accounts.updateGroup,
    );
}
