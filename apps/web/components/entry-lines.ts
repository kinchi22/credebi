import {
  accountsIn,
  sideSchema,
  type AccountId,
  type AccountType,
  type ChartOutput,
  type Side,
} from '@repo/contracts';

export const SIDES: readonly Side[] = sideSchema.options;

type SidedLine = {
  readonly side: Side;
};

type WithLines<Line extends SidedLine> = {
  readonly lines: readonly Line[];
};

export const linesOn = <Line extends SidedLine>(
  entry: WithLines<Line>,
  side: Side,
): readonly Line[] => entry.lines.filter((line) => line.side === side);

export const hasOneLinePerSide = (entry: WithLines<SidedLine>): boolean =>
  SIDES.every((side) => linesOn(entry, side).length === 1);

export type EntryExpansion = {
  readonly open: boolean;
  readonly toggles: boolean;
};

export const entryExpansion = (
  entry: WithLines<SidedLine>,
  held: boolean | undefined,
  toggledOpen: boolean,
): EntryExpansion =>
  held === undefined
    ? { open: toggledOpen, toggles: !hasOneLinePerSide(entry) }
    : { open: held, toggles: false };

export type AccountTypes = ReadonlyMap<AccountId, AccountType>;

export const accountTypesIn = (chart: ChartOutput): AccountTypes =>
  new Map(accountsIn(chart).map((account) => [account.id, account.accountType]));
