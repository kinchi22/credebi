import { type AccountId, type EntryId, type Money, type Side } from '@repo/contracts';
import { titleKey } from './title-match';

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

export type SuggestedAccounts = Readonly<Record<Side, readonly AccountId[]>>;

export type OfferedTitle = {
  readonly title: string;
  readonly lines: readonly TitledLine[];
  readonly suggested: SuggestedAccounts;
};

export function offeredSince(now: Date): Date {
  const since = new Date(now.getTime());
  since.setUTCFullYear(since.getUTCFullYear() - TITLE_WINDOW_YEARS);
  return since;
}

const latestFirst = (first: TitledEntry, second: TitledEntry): number =>
  second.createdAt.getTime() - first.createdAt.getTime() || second.id.localeCompare(first.id);

type Tally = {
  readonly account: AccountId;
  count: number;
};

function rankedOn(side: Side, latestFirstEntries: readonly TitledEntry[]): readonly AccountId[] {
  const tallies = new Map<AccountId, Tally>();
  for (const { lines } of latestFirstEntries) {
    const onSide = new Set(lines.filter((line) => line.side === side).map(({ account }) => account));
    for (const account of [...onSide].sort()) {
      const tally = tallies.get(account);
      if (tally === undefined) {
        tallies.set(account, { account, count: 1 });
      } else {
        tally.count += 1;
      }
    }
  }
  return [...tallies.values()]
    .sort((first, second) => second.count - first.count)
    .map(({ account }) => account);
}

type Titled = {
  readonly latest: TitledEntry;
  readonly entries: TitledEntry[];
};

export function offeredTitles(entries: readonly TitledEntry[]): readonly OfferedTitle[] {
  const byTitle = new Map<string, Titled>();
  for (const entry of [...entries].sort(latestFirst)) {
    const key = titleKey(entry.title);
    const titled = byTitle.get(key);
    if (titled !== undefined) {
      titled.entries.push(entry);
    } else if (key !== '') {
      byTitle.set(key, { latest: entry, entries: [entry] });
    }
  }
  return [...byTitle.values()].map(({ latest, entries: titled }) => ({
    title: latest.title,
    lines: latest.lines,
    suggested: { debit: rankedOn('debit', titled), credit: rankedOn('credit', titled) },
  }));
}
