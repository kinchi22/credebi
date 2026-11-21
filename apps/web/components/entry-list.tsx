'use client';

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
import { ChevronIcon, Panel, PANEL_BLEED } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type MouseEvent, type ReactNode, type RefObject, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatAmount } from './amount';
import { DeleteEntry, type DeleteEntryAction } from './delete-entry';
import { EditEntry, type EditEntryAction } from './edit-entry';
import { BARE_ICON_BUTTON } from './control-classes';
import { accountTypesIn, entryExpansion, linesOn, SIDES, type AccountTypes } from './entry-lines';
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

export type HeldOpen = ReadonlyMap<PostedEntry['id'], boolean>;

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
  readonly controls: EntryControls;
  readonly heldOpen?: HeldOpen;
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

const COMPACT_LINES: Readonly<Record<Side, string>> = {
  debit: '@max-list:row-start-2 @max-list:border-t-[1.5px] @max-list:pt-1 @max-list:pr-2 @max-list:pl-0',
  credit:
    '@max-list:col-start-2 @max-list:row-start-2 @max-list:border-t-[1.5px] @max-list:border-l @max-list:border-l-border @max-list:pt-1 @max-list:pr-0 @max-list:pl-2',
};

const COMPACT_HIDDEN = '@max-list:sr-only';

const SIDE_HEADING = `${typeClasses.label} leading-5`;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const entryTransitionName = (entry: PostedEntry): string => `entry-${entry.id}`;

const lineTransitionName = (entry: PostedEntry, side: Side, index: number): string =>
  `${entryTransitionName(entry)}-${side}-${String(index)}`;

const INTERACTIVE_DESCENDANTS = 'a, button, input, select, textarea, label, dialog, [role="dialog"]';

function SideHeadings({ named, compact }: { readonly named: boolean; readonly compact: boolean }): ReactNode {
  const t = useTranslations();
  return (
    <div role={named ? 'row' : undefined} aria-hidden={named ? undefined : true} className="contents">
      {SIDES.map((side) => (
        <span
          key={side}
          role={named ? 'columnheader' : undefined}
          className={`${SIDE_HEADING_GRID[side]} ${SIDE_HEADING} ${SIDE_TONE[side].edge} ${SIDE_TONE[side].text} ${compact ? COMPACT_HIDDEN : ''}`}
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
  compact,
  transitionName,
}: {
  readonly line: PostedLine;
  readonly accountType: AccountType | undefined;
  readonly compact: boolean;
  readonly transitionName: string;
}): ReactNode {
  const cuedName = useCuedAccountName();
  return (
    <li
      data-testid="entry-line"
      aria-label={
        accountType === undefined ? undefined : cuedName(line.accountName, accountType, line.side)
      }
      style={{ viewTransitionName: transitionName, viewTransitionClass: 'entry-expansion-line' }}
      className="flex items-baseline gap-x-3 py-1"
    >
      <LineAccount line={line} accountType={accountType} />{' '}
      <span className={`${LINE_AMOUNT} ${SIDE_TONE[line.side].text} ${compact ? COMPACT_HIDDEN : ''}`}>
        {formatAmount(line.amount)}
      </span>
    </li>
  );
}

function SideLines({
  entry,
  side,
  accountTypes,
  compact,
}: {
  readonly entry: PostedEntry;
  readonly side: Side;
  readonly accountTypes: AccountTypes;
  readonly compact: boolean;
}): ReactNode {
  return (
    <div
      role="cell"
      className={`min-w-0 ${SIDE_LINES_GRID[side]} ${SIDE_TONE[side].edge} ${compact ? COMPACT_LINES[side] : ''}`}
    >
      <ul>
        {linesOn(entry, side).map((line, index) => (
          <SideLine
            key={index}
            line={line}
            accountType={accountTypes.get(line.account)}
            compact={compact}
            transitionName={lineTransitionName(entry, side, index)}
          />
        ))}
      </ul>
    </div>
  );
}

function togglesOnClick(event: MouseEvent<HTMLElement>, chevron: HTMLButtonElement | null): boolean {
  const target = event.target;
  return (
    chevron !== null &&
    chevron.checkVisibility() &&
    target instanceof Element &&
    event.currentTarget.contains(target) &&
    target.closest(INTERACTIVE_DESCENDANTS) === null &&
    window.getSelection()?.isCollapsed !== false
  );
}

type SelfToggle = {
  readonly expanded: boolean;
  readonly toggle: () => void;
  readonly chevron: RefObject<HTMLButtonElement | null>;
  readonly toggleOnBodyClick: (event: MouseEvent<HTMLElement>) => void;
};

function useSelfToggle(): SelfToggle {
  const [expanded, setExpanded] = useState(false);
  const chevron = useRef<HTMLButtonElement>(null);
  const toggleAtOnce = (): void => {
    setExpanded((current) => !current);
  };
  const toggle = (): void => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches || !('startViewTransition' in document)) {
      toggleAtOnce();
      return;
    }
    document.startViewTransition(() => {
      flushSync(toggleAtOnce);
    });
  };
  return {
    expanded,
    toggle,
    chevron,
    toggleOnBodyClick: (event) => {
      if (togglesOnClick(event, chevron.current)) toggle();
    },
  };
}

function ListedEntry({
  entry,
  headsColumns,
  controls,
  accountTypes,
  held,
}: {
  readonly entry: PostedEntry;
  readonly headsColumns: boolean;
  readonly controls: EntryControls;
  readonly accountTypes: AccountTypes;
  readonly held: boolean | undefined;
}): ReactNode {
  const t = useTranslations();
  const selfToggle = useSelfToggle();
  const { toggle, chevron, toggleOnBodyClick } = selfToggle;
  const { open: expanded, toggles: expandable } = entryExpansion(entry, held, selfToggle.expanded);
  const compact = !expanded;
  return (
    <div
      role="rowgroup"
      data-testid="entry"
      onClick={expandable ? toggleOnBodyClick : undefined}
      style={{ viewTransitionName: entryTransitionName(entry), viewTransitionClass: 'entry-expansion' }}
      className={`${PANEL_BLEED} relative grid grid-cols-1 @list:grid-cols-2 ${compact ? '@max-list:grid-cols-2' : ''} ${expandable ? '@max-list:cursor-pointer' : ''} border-t border-border py-4 first:border-t-0 first:pt-1 hover:bg-surface-hover ${typeClasses['body-dense']}`}
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
      <SideHeadings named={headsColumns} compact={compact} />
      <div role="row" className="contents">
        {SIDES.map((side) => (
          <SideLines
            key={side}
            entry={entry}
            side={side}
            accountTypes={accountTypes}
            compact={compact}
          />
        ))}
      </div>
      {expandable ? (
        <button
          ref={chevron}
          type="button"
          aria-expanded={expanded}
          aria-label={t('entryList.expand', {
            date: entry.entryDate,
            entry: entry.title === '' ? entry.memo : entry.title,
          })}
          onClick={toggle}
          className={`absolute bottom-0 left-1/2 h-4 w-10 -translate-x-1/2 @list:hidden ${BARE_ICON_BUTTON}`}
        >
          <span className={`flex ${expanded ? '-rotate-90' : 'rotate-90'}`}>
            <ChevronIcon />
          </span>
        </button>
      ) : null}
    </div>
  );
}


export function EntryList({ entries, controls, heldOpen }: EntryListProps): ReactNode {
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
              held={heldOpen?.get(entry.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
