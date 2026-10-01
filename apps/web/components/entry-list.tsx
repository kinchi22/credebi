import { sideSchema, type PostedEntry, type Side } from '@repo/contracts';
import { isAccountCode, type AccountCode } from '@repo/core/entries';
import { Panel } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import { formatAmount } from './amount';
import { SIDE_TONE } from './side-classes';
import { MUTED_TEXT } from './text-classes';

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
};

type EntryLine = PostedEntry['lines'][number];

const ACCOUNT_NAMES: Readonly<Record<AccountCode, string>> = en.accounts;

const SIDES: readonly Side[] = sideSchema.options;

const accountName = (code: string): string => (isAccountCode(code) ? ACCOUNT_NAMES[code] : code);

const linesOn = (entry: PostedEntry, side: Side): readonly EntryLine[] =>
  entry.lines.filter((line) => line.side === side);

const isCompact = (entry: PostedEntry): boolean =>
  SIDES.every((side) => linesOn(entry, side).length === 1);

const ROW =
  '-mx-4 grid grid-cols-2 gap-x-4 px-4 wide:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,13rem)_minmax(0,13rem)]';
const SPAN_NARROW = 'col-span-2 wide:col-span-1';
const AMOUNT = `ml-auto text-right ${typeClasses.figure}`;

function ColumnHeaders(): ReactNode {
  return (
    <div role="row" className={`${ROW} pb-2 ${typeClasses.label}`}>
      <span role="columnheader" className="hidden text-text-muted wide:block">
        {en.entryList.date}
      </span>
      <span role="columnheader" className="hidden text-text-muted wide:block">
        {en.entryList.memo}
      </span>
      {SIDES.map((side) => (
        <span
          key={side}
          role="columnheader"
          className={`border-b-2 pb-1 ${SIDE_TONE[side].edge} ${SIDE_TONE[side].text}`}
        >
          {en.sides[side]}
        </span>
      ))}
    </div>
  );
}

function SideLines({ entry, side }: { readonly entry: PostedEntry; readonly side: Side }): ReactNode {
  return (
    <div role="cell" className="min-w-0">
      <ul>
        {linesOn(entry, side).map((line, index) => (
          <li key={index} data-testid="entry-line" className="flex flex-wrap items-baseline gap-x-2">
            <span className="min-w-0">{accountName(line.account)}</span>{' '}
            <span className={`${AMOUNT} ${SIDE_TONE[side].text}`}>{formatAmount(line.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListedEntry({ entry }: { readonly entry: PostedEntry }): ReactNode {
  const compact = isCompact(entry);

  return (
    <div
      role="row"
      data-testid="entry"
      className={`${ROW} gap-y-1 border-t border-border py-3 ${typeClasses['body-sm']}`}
    >
      <div role="cell" className={SPAN_NARROW}>
        <time dateTime={entry.entryDate} className={`${typeClasses.date} text-text-muted`}>
          {entry.entryDate}
        </time>
      </div>
      <div role="cell" className={`${SPAN_NARROW} flex min-w-0 flex-col`}>
        <span className="font-semibold">{entry.memo}</span>{' '}
        <span className={compact ? 'sr-only' : `flex gap-2 ${MUTED_TEXT}`}>
          <span>{en.entryList.total}</span>{' '}
          <span data-testid="entry-total" className={typeClasses.figure}>
            {formatAmount(entry.total)}
          </span>
        </span>
      </div>
      {SIDES.map((side) => (
        <SideLines key={side} entry={entry} side={side} />
      ))}
    </div>
  );
}

export function EntryList({ entries }: EntryListProps): ReactNode {
  return (
    <Panel title={en.entryList.title}>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{en.entryList.empty}</p>
      ) : (
        <div role="table" aria-label={en.entryList.title}>
          <ColumnHeaders />
          {entries.map((entry) => (
            <ListedEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </Panel>
  );
}
