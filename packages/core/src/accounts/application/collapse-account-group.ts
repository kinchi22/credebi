import { ok, type CollapseAccountGroupInput, type DomainError, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { findGroup, type AccountGroup } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type CollapseAccountGroupDependencies = {
  readonly accounts: AccountRepository;
};

export type CollapseAccountGroup = (
  auth: AuthContext,
  input: CollapseAccountGroupInput,
) => Promise<Result<AccountGroup, DomainError>>;

export function createCollapseAccountGroup({
  accounts,
}: CollapseAccountGroupDependencies): CollapseAccountGroup {
  return (auth, { id, collapsed }) =>
    changeChart(
      accounts,
      auth,
      (chart) => {
        const group = findGroup(chart, id);
        return group.ok ? ok({ ...group.value, collapsed }) : group;
      },
      (userId, group) => accounts.collapseGroup(userId, group.id, group.collapsed),
    );
}
