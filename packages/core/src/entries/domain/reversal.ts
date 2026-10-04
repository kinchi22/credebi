import { type EntryId, type Side } from '@repo/contracts';
import { type Entry, type EntryStamp } from './entry';

export type Reversal = Entry & {
  readonly reverses: EntryId;
};

const OPPOSITE: Readonly<Record<Side, Side>> = { debit: 'credit', credit: 'debit' };

export function makeReversal(entry: Entry, stamp: EntryStamp): Reversal {
  return {
    id: stamp.id,
    entryDate: entry.entryDate,
    memo: entry.memo,
    lines: entry.lines.map((line) => ({ ...line, side: OPPOSITE[line.side] })),
    total: entry.total,
    createdAt: stamp.createdAt,
    reverses: entry.id,
  };
}
