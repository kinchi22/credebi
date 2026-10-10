import { accountsIn, type AccountId, type ChartOutput, type Side } from '@repo/contracts';
import { isActiveOn } from '@repo/core/accounts';
import { draftLinesInOrder } from '@repo/core/entries';

export type Offered = {
  readonly chart: ChartOutput;
  readonly ids: ReadonlySet<AccountId>;
};

function chartOn(chart: ChartOutput, day: string | undefined): ChartOutput {
  if (day === undefined || day === '') {
    return chart;
  }
  return chart.flatMap((node): ChartOutput => {
    if (node.kind === 'account') {
      return isActiveOn(node.account, day) ? [node] : [];
    }
    const accounts = node.accounts.filter((account) => isActiveOn(account, day));
    return accounts.length === 0 ? [] : [{ ...node, accounts }];
  });
}

export function offeredOn(chart: ChartOutput, day: string | undefined): Offered {
  const offered = chartOn(chart, day);
  return { chart: offered, ids: new Set(accountsIn(offered).map((account) => account.id)) };
}

type AccountLine = {
  readonly side: Side;
  readonly account: AccountId;
};

export type LinesOnDay<Line extends AccountLine> = {
  readonly counted: readonly Line[];
  readonly notActive: readonly Line[];
};

export function linesOnDay<Line extends AccountLine>(
  offered: Offered,
  lines: readonly Line[],
): LinesOnDay<Line> {
  const inOrder = draftLinesInOrder(lines);
  return {
    counted: inOrder.filter((line) => offered.ids.has(line.account)),
    notActive: inOrder.filter((line) => !offered.ids.has(line.account)),
  };
}

export const lineHoldingSubmit = <Line extends AccountLine>(
  lines: LinesOnDay<Line>,
): Line | undefined => lines.notActive[0];

