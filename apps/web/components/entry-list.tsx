import { useTranslations } from 'next-intl';
import {
  type AccountType,
  type ChartOutput,
  type EntryFormMode,
  type PostedEntry,
  type Side,
  type OfferedTitle,
  type PostedLine,
} from '@repo/contracts';
import { Panel, PANEL_BLEED } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { formatAmount } from './amount';
import { DeleteEntry, type DeleteEntryAction } from './delete-entry';
import { EditEntry, type EditEntryAction } from './edit-entry';
import { accountTypesIn, linesOn, SIDES, type AccountTypes } from './entry-lines';
import { SIDE_TONE } from './side-classes';
import { MUTED_TEXT } from './text-classes';
import { CuedAccount, useCuedAccountName } from './type-band';

export type EntryControls = {
  readonly chart: ChartOutput;
  readonly titles: readonly OfferedTitle[];
  readonly entryFormMode: EntryFormMode;
  readonly editEntry: EditEntryAction;
  readonly deleteEntry: DeleteEntryAction;
};

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
  readonly controls: EntryControls;
};

const CREDIT_DIVIDER = '@list:border-l @list:border-l-border';

const SIDE_RULE = 'border-t-[1.5px]';

const LINE_AMOUNT = `ml-auto shrink-0 whitespace-nowrap text-right ${typeClasses.figure}`;

const SIDE_HEADING_GRID: Readonly<Record<Side, string>> = {
  debit: `col-start-1 row-start-2 ${SIDE_RULE} px-4 pt-2`,
  credit: `col-start-1 row-start-4 mt-2 @list:col-start-2 @list:row-start-2 @list:mt-0 ${SIDE_RULE} px-4 pt-2 ${CREDIT_DIVIDER}`,
};

const SIDE_LINES_GRID: Readonly<Record<Side, string>> = {
  debit: 'col-start-1 row-start-3 px-4 pb-1',
  credit: `col-start-1 row-start-5 @list:col-start-2 @list:row-start-3 px-4 pb-1 ${CREDIT_DIVIDER}`,
};

const SIDE_HEADING = `${typeClasses.label} leading-5`;

function SideHeadings({ named }: { readonly named: boolean }): ReactNode {
  const t = useTranslations();
  return (
    <div role={named ? 'row' : undefined} aria-hidden={named ? undefined : true} className="contents">
      {SIDES.map((side) => (
        <span
          key={side}
          role={named ? 'columnheader' : undefined}
          className={`${SIDE_HEADING_GRID[side]} ${SIDE_HEADING} ${SIDE_TONE[side].edge} ${SIDE_TONE[side].text}`}
        >
          {t(`sides.${side}`)}
        </span>
      ))}
    </div>
  );
}

function LineAccount({
  line,
  accountType,
}: {
  readonly line: PostedLine;
  readonly accountType: AccountType | undefined;
}): ReactNode {
  const name = <span className="min-w-0 wrap-anywhere">{line.accountName}</span>;
  return accountType === undefined ? (
    name
  ) : (
    <CuedAccount accountType={accountType} side={line.side}>
      {name}
    </CuedAccount>
  );
}

function SideLine({
  line,
  accountType,
}: {
  readonly line: PostedLine;
  readonly accountType: AccountType | undefined;
}): ReactNode {
  const cuedName = useCuedAccountName();
  return (
    <li
      data-testid="entry-line"
      aria-label={
        accountType === undefined ? undefined : cuedName(line.accountName, accountType, line.side)
      }
      className="flex items-baseline gap-x-3 py-1"
    >
      <LineAccount line={line} accountType={accountType} />{' '}
      <span className={`${LINE_AMOUNT} ${SIDE_TONE[line.side].text}`}>
        {formatAmount(line.amount)}
      </span>
    </li>
  );
}

function SideLines({
  entry,
  side,
  accountTypes,
}: {
  readonly entry: PostedEntry;
  readonly side: Side;
  readonly accountTypes: AccountTypes;
}): ReactNode {
  return (
    <div role="cell" className={`min-w-0 ${SIDE_LINES_GRID[side]} ${SIDE_TONE[side].edge}`}>
      <ul>
        {linesOn(entry, side).map((line, index) => (
          <SideLine key={index} line={line} accountType={accountTypes.get(line.account)} />
        ))}
      </ul>
    </div>
  );
}

function ListedEntry({
  entry,
  headsColumns,
  controls,
  accountTypes,
}: {
  readonly entry: PostedEntry;
  readonly headsColumns: boolean;
  readonly controls: EntryControls;
  readonly accountTypes: AccountTypes;
}): ReactNode {
  const t = useTranslations();
  return (
    <div
      role="rowgroup"
      data-testid="entry"
      className={`${PANEL_BLEED} grid grid-cols-1 @list:grid-cols-2 border-t border-border py-4 first:border-t-0 first:pt-1 hover:bg-surface-hover ${typeClasses['body-dense']}`}
    >
      <div role="row" className="contents">
        <div
          role="cell"
          className="col-span-full row-start-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 pb-2"
        >
          <p
            className={`contents @list:col-start-1 @list:row-start-1 @list:flex @list:min-w-0 @list:items-baseline @list:gap-x-3.5 ${typeClasses['body-sm']}`}
          >
            <time
              dateTime={entry.entryDate}
              className={`${typeClasses.date} col-start-1 row-start-1 shrink-0 text-text-muted`}
            >
              {entry.entryDate}
            </time>{' '}
            <span className="contents @list:flex @list:min-w-0 @list:grow @list:flex-wrap @list:items-baseline @list:gap-x-2">
              {entry.title === '' ? null : (
                <>
                  <span className="col-start-1 row-start-2 self-baseline font-semibold wrap-anywhere">
                    {entry.title}
                  </span>{' '}
                </>
              )}
              {entry.memo === '' ? null : (
                <span className="col-span-full row-start-3 min-w-0 wrap-anywhere text-text-muted">
                  {entry.memo}
                </span>
              )}
            </span>{' '}
            <span className="col-start-2 row-start-2 shrink-0 self-baseline justify-self-end">
              <span className="sr-only">{t('entryList.total')} </span>
              <span data-testid="entry-total" className={`${typeClasses.figure} font-medium`}>
                {formatAmount(entry.total)}
              </span>
            </span>
          </p>
          <div className="col-start-2 row-start-1 flex items-start gap-x-2 justify-self-end">
            <EditEntry
              entry={entry}
              chart={controls.chart}
              titles={controls.titles}
              entryFormMode={controls.entryFormMode}
              action={controls.editEntry}
            />
            <DeleteEntry entry={entry} action={controls.deleteEntry} />
          </div>
        </div>
      </div>
      <SideHeadings named={headsColumns} />
      <div role="row" className="contents">
        {SIDES.map((side) => (
          <SideLines key={side} entry={entry} side={side} accountTypes={accountTypes} />
        ))}
      </div>
    </div>
  );
}

export function EntryList({ entries, controls }: EntryListProps): ReactNode {
  const t = useTranslations();
  const accountTypes = accountTypesIn(controls.chart);
  return (
    <Panel title={t('entryList.title')} titleHidden>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{t('entryList.empty')}</p>
      ) : (
        <div role="table" aria-label={t('entryList.title')} className="@container">
          {entries.map((entry, index) => (
            <ListedEntry
              key={entry.id}
              entry={entry}
              headsColumns={index === 0}
              controls={controls}
              accountTypes={accountTypes}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
