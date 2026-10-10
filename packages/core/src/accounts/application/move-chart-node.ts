import { type DomainError, type MoveChartNodeInput, type Result } from '@repo/contracts';
import { type AuthContext } from '../../auth/domain/auth-context';
import { type Chart } from '../domain/account';
import { movedNode } from '../domain/move';
import { type AccountRepository } from '../ports/account-repository';
import { changeChart } from './change-chart';

export type MoveChartNodeDependencies = {
  readonly accounts: AccountRepository;
};

export type MoveChartNode = (
  auth: AuthContext,
  input: MoveChartNodeInput,
) => Promise<Result<Chart, DomainError>>;

export function createMoveChartNode({ accounts }: MoveChartNodeDependencies): MoveChartNode {
  return (auth, input) =>
    changeChart(accounts, auth, (chart) => movedNode(chart, input), accounts.placeNodes);
}
