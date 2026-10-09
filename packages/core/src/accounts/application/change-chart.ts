import { ok, type DomainError, type Result, type UserId } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Chart } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export async function changeChart<Node>(
  accounts: AccountRepository,
  auth: AuthContext,
  change: (chart: Chart) => Result<Node, DomainError>,
  save: (userId: UserId, node: Node) => Promise<Result<void, DomainError>>,
): Promise<Result<Node, DomainError>> {
  const userId = requireUser(auth);
  if (!userId.ok) {
    return userId;
  }

  const chart = await accounts.readChart(userId.value);
  if (!chart.ok) {
    return chart;
  }

  const node = change(chart.value);
  if (!node.ok) {
    return node;
  }

  const saved = await save(userId.value, node.value);
  return saved.ok ? ok(node.value) : saved;
}
