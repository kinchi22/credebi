import { type EntryLineInput, type PostedEntry, type Side } from '@repo/contracts';
import { SIDES } from './side-classes';

export const linesOn = (entry: PostedEntry, side: Side): readonly EntryLineInput[] =>
  entry.lines.filter((line) => line.side === side);

export const hasOneLinePerSide = (entry: PostedEntry): boolean =>
  SIDES.every((side) => linesOn(entry, side).length === 1);
