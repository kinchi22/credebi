import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from './account';

export function removedAccount(
  chart: Chart,
  id: AccountId,
  named: boolean,
): Result<Account, DomainError> {
  const account = chart.accounts.find((candidate) => candidate.id === id);
  if (account === undefined) {
    return err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`));
  }
  if (named) {
    return err(
      domainError(
        'IN_USE',
        `An Entry names Account "${account.name}", a deleted or edited Entry included, so it cannot be deleted; give it an end day instead.`,
      ),
    );
  }
  return ok(account);
}

export function removedGroup(chart: Chart, id: AccountGroupId): Result<AccountGroup, DomainError> {
  const group = chart.groups.find((candidate) => candidate.id === id);
  if (group === undefined) {
    return err(
      domainError('NOT_FOUND', `Account group ${id} is not in the User's chart of accounts.`),
    );
  }
  if (chart.accounts.some((account) => account.groupId === id)) {
    return err(
      domainError(
        'IN_USE',
        `Account group "${group.name}" holds Accounts, so it cannot be deleted until it is empty.`,
      ),
    );
  }
  return ok(group);
}
