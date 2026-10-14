import {
  domainError,
  err,
  type AccountGroupId,
  type DomainError,
  type Err,
  type Result,
} from '@repo/contracts';
import { findGroup, type Account, type AccountGroup, type Chart } from './account';

export type AccountRemoval = 'refused' | 'deleted' | 'marked';

export function accountInUse(account: Account): Err<DomainError> {
  return err(
    domainError(
      'IN_USE',
      `A shown Entry names Account "${account.name}", so it cannot be deleted; give it an end day instead.`,
    ),
  );
}

export function removedGroup(chart: Chart, id: AccountGroupId): Result<AccountGroup, DomainError> {
  const group = findGroup(chart, id);
  if (group.ok && chart.accounts.some((account) => account.groupId === id)) {
    return err(
      domainError(
        'IN_USE',
        `Account group "${group.value.name}" holds Accounts, so it cannot be deleted until it is empty.`,
      ),
    );
  }
  return group;
}
