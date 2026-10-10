import {
  type ChartOutput,
  type EntryFormMode,
  type PostedEntry,
  type Side,
} from '@repo/contracts';
import { Panel, PANEL_BLEED } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import { formatAmount } from './amount';
import { DeleteEntry, type DeleteEntryAction } from './delete-entry';
import { EditEntry, type EditEntryAction } from './edit-entry';
import { hasOneLinePerSide, linesOn } from './entry-lines';
import { SIDE_TONE, SIDES } from './side-classes';
import { MUTED_TEXT } from './text-classes';

export type EntryControls = {
  readonly chart: ChartOutput;
  readonly entryFormMode: EntryFormMode;
  readonly editEntry: EditEntryAction;
  readonly deleteEntry: DeleteEntryAction;
};

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
  readonly controls: EntryControls;
};

type Layout = {
  readonly grid: string;
  readonly heading: Readonly<Record<Side, string>>;
  readonly lines: Readonly<Record<Side, string>>;
  readonly lineAmount: string;
};

const CREDIT_DIVIDER = 'border-l border-l-border';

const SIDE_RULE = 'border-t-[1.5px]';

const COMPACT: Layout = {
  grid: 'grid-cols-[5rem_minmax(0,1fr)_5rem_minmax(0,1fr)]',
  heading: {
    debit: `col-start-1 row-start-2 ${SIDE_RULE} py-2 pl-4`,
    credit: `col-start-3 row-start-2 ${SIDE_RULE} py-2 pl-4 ${CREDIT_DIVIDER}`,
  },
  lines: {
    debit: `col-start-2 row-start-2 ${SIDE_RULE} py-2 pr-4`,
    credit: `col-start-4 row-start-2 ${SIDE_RULE} py-2 pr-4`,
  },
  lineAmount: 'sr-only',
};

const STACKED: Layout = {
  grid: 'grid-cols-2',
  heading: {
    debit: `col-start-1 row-start-2 ${SIDE_RULE} px-4 pt-2`,
    credit: `col-start-2 row-start-2 ${SIDE_RULE} px-4 pt-2 ${CREDIT_DIVIDER}`,
  },
  lines: {
    debit: 'col-start-1 row-start-3 px-4 pb-1',
    credit: `col-start-2 row-start-3 px-4 pb-1 ${CREDIT_DIVIDER}`,
  },
  lineAmount: `ml-auto text-right ${typeClasses.figure}`,
};

const SIDE_HEADING = `${typeClasses.label} leading-5`;

function SideHeadings({ layout, named }: { readonly layout: Layout; readonly named: boolean }): ReactNode {
  return (
    <div role={named ? 'row' : undefined} aria-hidden={named ? undefined : true} className="contents">
      {SIDES.map((side) => (
        <span
          key={side}
          role={named ? 'columnheader' : undefined}
          className={`${layout.heading[side]} ${SIDE_HEADING} ${SIDE_TONE[side].edge} ${SIDE_TONE[side].text}`}
        >
          {en.sides[side]}
        </span>
      ))}
    </div>
  );
}

function SideLines({
  entry,
  side,
  layout,
}: {
  readonly entry: PostedEntry;
  readonly side: Side;
  readonly layout: Layout;
}): ReactNode {
  return (
    <div role="cell" className={`min-w-0 ${layout.lines[side]} ${SIDE_TONE[side].edge}`}>
      <ul>
        {linesOn(entry, side).map((line, index) => (
          <li key={index} data-testid="entry-line" className="flex items-baseline gap-x-3 py-1">
            <span className="min-w-0">{line.accountName}</span>{' '}
            <span className={`${layout.lineAmount} ${SIDE_TONE[side].text}`}>
              {formatAmount(line.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListedEntry({
  entry,
  headsColumns,
  controls,
}: {
  readonly entry: PostedEntry;
  readonly headsColumns: boolean;
  readonly controls: EntryControls;
}): ReactNode {
  const layout = hasOneLinePerSide(entry) ? COMPACT : STACKED;
  return (
    <div
      role="rowgroup"
      data-testid="entry"
      className={`${PANEL_BLEED} grid ${layout.grid} border-t border-border py-4 first:border-t-0 first:pt-1 hover:bg-surface-hover ${typeClasses['body-dense']}`}
    >
      <div role="row" className="contents">
        <div role="cell" className="col-span-full row-start-1 flex items-start gap-x-2 pb-2">
          <p className={`flex min-w-0 grow items-baseline gap-x-3.5 ${typeClasses['body-sm']}`}>
            <time dateTime={entry.entryDate} className={`${typeClasses.date} shrink-0 text-text-muted`}>
              {entry.entryDate}
            </time>{' '}
            <span className="min-w-0 grow font-medium">{entry.memo}</span>{' '}
            <span className="shrink-0">
              <span className="sr-only">{en.entryList.total} </span>
              <span data-testid="entry-total" className={`${typeClasses.figure} font-medium`}>
                {formatAmount(entry.total)}
              </span>
            </span>
          </p>
          <EditEntry
            entry={entry}
            chart={controls.chart}
            entryFormMode={controls.entryFormMode}
            action={controls.editEntry}
          />
          <DeleteEntry entry={entry} action={controls.deleteEntry} />
        </div>
      </div>
      <SideHeadings layout={layout} named={headsColumns} />
      <div role="row" className="contents">
        {SIDES.map((side) => (
          <SideLines key={side} entry={entry} side={side} layout={layout} />
        ))}
      </div>
    </div>
  );
}

export function EntryList({ entries, controls }: EntryListProps): ReactNode {
  return (
    <Panel title={en.entryList.title} titleHidden>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{en.entryList.empty}</p>
      ) : (
        <div role="table" aria-label={en.entryList.title}>
          {entries.map((entry, index) => (
            <ListedEntry
              key={entry.id}
              entry={entry}
              headsColumns={index === 0}
              controls={controls}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
