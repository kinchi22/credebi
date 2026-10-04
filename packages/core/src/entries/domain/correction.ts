import { type Entry, type EntryDraft } from './entry';

const linesKey = (lines: EntryDraft['lines']): string =>
  JSON.stringify(lines.map((line) => [line.account, line.side, line.amount]));

export function changesEntry(draft: EntryDraft, entry: Entry): boolean {
  return (
    draft.entryDate !== entry.entryDate ||
    draft.memo.trim() !== entry.memo ||
    linesKey(draft.lines) !== linesKey(entry.lines)
  );
}
