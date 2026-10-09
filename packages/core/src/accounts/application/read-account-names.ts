import { ok, type DomainError, type Result, type UserId } from '@repo/contracts';
import { accountNames, type AccountNames } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export async function readAccountNames(
  accounts: AccountRepository,
  userId: UserId,
): Promise<Result<AccountNames, DomainError>> {
  const chart = await accounts.readChart(userId);
  return chart.ok ? ok(accountNames(chart.value.accounts)) : chart;
}
