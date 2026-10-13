import { type AccountId, type EntryId, type Money, type Side } from '@repo/contracts';

export const TITLE_WINDOW_YEARS = 2;

export type TitledLine = {
  readonly account: AccountId;
  readonly side: Side;
  readonly amount: Money;
};

export type TitledEntry = {
  readonly id: EntryId;
  readonly title: string;
  readonly createdAt: Date;
  readonly lines: readonly TitledLine[];
};

export type OfferedTitle = {
  readonly title: string;
  readonly lines: readonly TitledLine[];
};

export function offeredSince(now: Date): Date {
  const since = new Date(now.getTime());
  since.setUTCFullYear(since.getUTCFullYear() - TITLE_WINDOW_YEARS);
  return since;
}

const latestFirst = (first: TitledEntry, second: TitledEntry): number =>
  second.createdAt.getTime() - first.createdAt.getTime() || second.id.localeCompare(first.id);

export function offeredTitles(entries: readonly TitledEntry[]): readonly OfferedTitle[] {
  const seen = new Set<string>();
  const offered: OfferedTitle[] = [];
  for (const { title, lines } of [...entries].sort(latestFirst)) {
    const folded = title.toLowerCase();
    if (title !== '' && !seen.has(folded)) {
      seen.add(folded);
      offered.push({ title, lines });
    }
  }
  return offered;
}
