import { type EntryLineInput, type PostedEntry, type Side } from '@repo/contracts';
import { isAccountCode, type AccountCode } from '@repo/core/entries';
import { Panel, PANEL_BLEED } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import { formatAmount } from './amount';
import { SIDE_TONE, SIDES } from './side-classes';
import { MUTED_TEXT } from './text-classes';

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
};

const ACCOUNT_NAMES: Readonly<Record<AccountCode, string>> = en.accounts;

const accountName = (code: string): string => (isAccountCode(code) ? ACCOUNT_NAMES[code] : code);

const linesOn = (entry: PostedEntry, side: Side): readonly EntryLineInput[] =>
  entry.lines.filter((line) => line.side === side);

const hasOneLinePerSide = (entry: PostedEntry): boolean =>
  SIDES.every((side) => linesOn(entry, side).length === 1);

const ROW = `${PANEL_BLEED} grid grid-cols-2 gap-x-4 wide:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_minmax(0,13rem)]`;
const ENTRY_CELL = 'col-span-2 min-w-0 wide:col-span-1';
const AMOUNT = `ml-auto text-right ${typeClasses.figure}`;

function ColumnHeaders(): ReactNode {
  return (
    <div role="row" className={`${ROW} pb-2 ${typeClasses.label}`}>
      <span role="columnheader" className="sr-only wide:not-sr-only">
        <span className="sr-only">{en.entryList.entry}</span>
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
  return (
    <div
      role="row"
      data-testid="entry"
      className={`${ROW} gap-y-1 border-t border-border py-3 ${typeClasses['body-sm']}`}
    >
      <div role="cell" className={ENTRY_CELL}>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <time dateTime={entry.entryDate} className={`${typeClasses.date} text-text-muted`}>
            {entry.entryDate}
          </time>{' '}
          <span className="min-w-0 font-semibold">{entry.memo}</span>
        </p>
        <p className={hasOneLinePerSide(entry) ? 'sr-only' : `flex gap-2 ${MUTED_TEXT}`}>
          <span>{en.entryList.total}</span>{' '}
          <span data-testid="entry-total" className={typeClasses.figure}>
            {formatAmount(entry.total)}
          </span>
        </p>
      </div>
      {SIDES.map((side) => (
        <SideLines key={side} entry={entry} side={side} />
      ))}
    </div>
  );
}

export function EntryList({ entries }: EntryListProps): ReactNode {
  return (
    <Panel title={en.entryList.title} titleHidden>
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
