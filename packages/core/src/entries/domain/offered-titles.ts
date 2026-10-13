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

type Named = {
  readonly account: AccountId;
  readonly firstSeen: number;
  count: number;
};

function rankedOn(side: Side, latestFirstEntries: readonly TitledEntry[]): readonly AccountId[] {
  const named = new Map<AccountId, Named>();
  latestFirstEntries.forEach(({ lines }, index) => {
    const onSide = new Set(lines.filter((line) => line.side === side).map(({ account }) => account));
    for (const account of onSide) {
      const known = named.get(account);
      if (known === undefined) {
        named.set(account, { account, firstSeen: index, count: 1 });
      } else {
        known.count += 1;
      }
    }
  });
  return [...named.values()]
    .sort(
      (first, second) =>
        second.count - first.count ||
        first.firstSeen - second.firstSeen ||
        first.account.localeCompare(second.account),
    )
    .map(({ account }) => account);
}

export function offeredTitles(entries: readonly TitledEntry[]): readonly OfferedTitle[] {
  const byTitle = new Map<string, TitledEntry[]>();
  for (const entry of [...entries].sort(latestFirst)) {
    if (entry.title !== '') {
      const folded = entry.title.toLowerCase();
      const titled = byTitle.get(folded);
      if (titled === undefined) {
        byTitle.set(folded, [entry]);
      } else {
        titled.push(entry);
      }
    }
  }
  return [...byTitle.values()].flatMap((titled) => {
    const [latest] = titled;
    return latest === undefined
      ? []
      : [
          {
            title: latest.title,
            lines: latest.lines,
            suggested: { debit: rankedOn('debit', titled), credit: rankedOn('credit', titled) },
          },
        ];
  });
}
