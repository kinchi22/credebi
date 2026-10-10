import {
  idOfNode,
  listIn,
  movedInChart,
  ok,
  type DomainError,
  type MoveChartNodeInput,
  type Result,
} from '@repo/contracts';
import { chartInOrder, findAccount, findGroup, type Chart } from './account';
import { groupOfType, invalid } from './account-details';

export function movedNode(chart: Chart, move: MoveChartNodeInput): Result<Chart, DomainError> {
  const moving =
    move.node.kind === 'account' ? findAccount(chart, move.node.id) : findGroup(chart, move.node.id);
  if (!moving.ok) {
    return moving;
  }
  if (moving.value.accountType !== move.accountType) {
    return invalid('Nothing moves to another Account type.');
  }
  if (move.groupId !== null) {
    if (move.node.kind === 'group') {
      return invalid('An Account group cannot be placed in an Account group.');
    }
    const group = groupOfType(chart, move.accountType, move.groupId);
    if (!group.ok) {
      return group;
    }
  }

  const outline = chartInOrder(chart);
  const others = listIn(outline, move).filter((node) => idOfNode(node) !== move.node.id);
  if (move.index > others.length) {
    return invalid(`A list of ${String(others.length)} others has no place ${String(move.index)}.`);
  }

  const placed = listIn(movedInChart(outline, move), move);
  return ok({
    accounts: placed.flatMap((node, position) =>
      node.kind === 'account' ? [{ ...node.account, position }] : [],
    ),
    groups: placed.flatMap((node, position) =>
      node.kind === 'group' ? [{ ...node.group, position }] : [],
    ),
  });
}
