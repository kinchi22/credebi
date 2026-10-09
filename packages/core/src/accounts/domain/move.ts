import {
  domainError,
  err,
  ok,
  type DomainError,
  type Err,
  type MoveChartNodeInput,
  type Result,
} from '@repo/contracts';
import { chartInOrder, type Account, type AccountGroup, type Chart, type ChartNode } from './account';

type Moving =
  | { readonly kind: 'account'; readonly node: Account }
  | { readonly kind: 'group'; readonly node: AccountGroup };

const invalid = (message: string): Err<DomainError> => err(domainError('INVALID_INPUT', message));

const notFound = (what: string, id: string): Err<DomainError> =>
  err(domainError('NOT_FOUND', `${what} ${id} is not in the User's chart of accounts.`));

function findMoving(chart: Chart, { node }: MoveChartNodeInput): Result<Moving, DomainError> {
  if (node.kind === 'account') {
    const account = chart.accounts.find((candidate) => candidate.id === node.id);
    return account === undefined ? notFound('Account', node.id) : ok({ kind: 'account', node: account });
  }
  const group = chart.groups.find((candidate) => candidate.id === node.id);
  return group === undefined ? notFound('Account group', node.id) : ok({ kind: 'group', node: group });
}

const nodeOf = (node: ChartNode): Account | AccountGroup =>
  node.kind === 'account' ? node.account : node.group;

function listOf(chart: Chart, move: MoveChartNodeInput): Result<readonly Moving[], DomainError> {
  const outline = chartInOrder(chart).filter((node) => nodeOf(node).accountType === move.accountType);
  if (move.groupId === null) {
    return ok(
      outline.map((node): Moving =>
        node.kind === 'account'
          ? { kind: 'account', node: node.account }
          : { kind: 'group', node: node.group },
      ),
    );
  }

  const { groupId } = move;
  const group = chart.groups.find((candidate) => candidate.id === groupId);
  if (group === undefined) {
    return notFound('Account group', groupId);
  }
  if (group.accountType !== move.accountType) {
    return invalid('An Account group holds Accounts of its own Account type only.');
  }
  return ok(
    outline.flatMap((node) =>
      node.kind === 'group' && node.group.id === groupId
        ? node.accounts.map((account): Moving => ({ kind: 'account', node: account }))
        : [],
    ),
  );
}

export function movedNode(chart: Chart, move: MoveChartNodeInput): Result<Chart, DomainError> {
  const moving = findMoving(chart, move);
  if (!moving.ok) {
    return moving;
  }
  if (moving.value.node.accountType !== move.accountType) {
    return invalid('Nothing moves to another Account type.');
  }
  if (moving.value.kind === 'group' && move.groupId !== null) {
    return invalid('An Account group cannot be placed in an Account group.');
  }

  const list = listOf(chart, move);
  if (!list.ok) {
    return list;
  }

  const others = list.value.filter(({ node }) => node.id !== moving.value.node.id);
  if (move.index > others.length) {
    return invalid(`A list of ${String(others.length)} others has no place ${String(move.index)}.`);
  }

  const placed = [...others.slice(0, move.index), moving.value, ...others.slice(move.index)];
  return ok({
    accounts: placed.flatMap((entry, position) =>
      entry.kind === 'account' ? [{ ...entry.node, groupId: move.groupId, position }] : [],
    ),
    groups: placed.flatMap((entry, position) =>
      entry.kind === 'group' ? [{ ...entry.node, position }] : [],
    ),
  });
}
