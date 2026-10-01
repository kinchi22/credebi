import { type Side } from '@repo/contracts';

type SidedLine = {
  readonly side: Side;
};

export function draftLinesInOrder<Line extends SidedLine>(lines: readonly Line[]): Line[] {
  return [
    ...lines.filter((line) => line.side === 'debit'),
    ...lines.filter((line) => line.side === 'credit'),
  ];
}
