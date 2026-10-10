import {
  domainError,
  err,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { findAccount, findGroup, type Account, type AccountGroup, type Chart } from './account';

export function removedAccount(
  chart: Chart,
  id: AccountId,
  named: boolean,
): Result<Account, DomainError> {
  const account = findAccount(chart, id);
  if (!account.ok) {
    return account;
  }
  if (named) {
    return err(
      domainError(
        'IN_USE',
        `An Entry names Account "${account.value.name}", a deleted or edited Entry included, so it cannot be deleted; give it an end day instead.`,
      ),
    );
  }
  return account;
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
