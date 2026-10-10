'use client';

import {
  ENTRY_FORM_FIELDS,
  accountsIn,
  nodesOfType,
  type AccountGroupOutput,
  type AccountId,
  type AccountOutput,
  type AccountType,
  type ChartOutput,
  type PostedEntry,
  type Side,
} from '@repo/contracts';
import { ACCOUNT_TYPES } from '@repo/core/accounts';
import { ChevronIcon, SearchIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { SETTINGS_PATH } from '../server/return-path';
import { CONTROL, PRIMARY_BUTTON } from './control-classes';
import { useHydrated } from './hydrated';
import { useModalDialog, type ModalDialog } from './modal-dialog';
import { branchesOf, nameContains, type Branch } from './chart-tree';
import { CloseButton } from './close-button';
import { type Offered } from './lines-on-day';
import { SheetBar, SheetTabs } from './sheet';
import { SIDE_TONE, SIDES } from './side-classes';
import { LINK } from './text-classes';
import { GroupFolder, TreeBranch, TreeHook } from './tree-branch';
import { useWide } from './wide';

export type AccountChoice = Readonly<Record<Side, AccountOutput | undefined>>;

export type AccountPickerProps = {
  readonly id: string;
  readonly chart: ChartOutput;
  readonly multiple?: boolean;
  readonly isChosen: (side: Side, account: AccountId) => boolean;
  readonly onPick: (side: Side, account: AccountOutput, chosen: boolean) => void;
  readonly sheet: AccountSheet;
};

export type AccountSheet = Omit<ModalDialog, 'show'> & {
  readonly id: string;
  readonly side: Side;
  readonly setSide: (side: Side) => void;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly openOn: (side: Side, opener: HTMLElement | null) => void;
};

type PickControl = {
  readonly groupRole: 'radiogroup' | 'group';
  readonly inputType: 'radio' | 'checkbox';
  readonly groupName: Readonly<Record<Side, string>>;
  readonly fieldName: Readonly<Record<Side, string>> | undefined;
};

const PICK_ONE: PickControl = {
  groupRole: 'radiogroup',
  inputType: 'radio',
  groupName: { debit: en.twoLineForm.debitAccount, credit: en.twoLineForm.creditAccount },
  fieldName: {
    debit: ENTRY_FORM_FIELDS.debitAccount,
    credit: ENTRY_FORM_FIELDS.creditAccount,
  },
};

const PICK_MANY: PickControl = {
  groupRole: 'group',
  inputType: 'checkbox',
  groupName: {
    debit: en.multiLineForm.debitAccounts,
    credit: en.multiLineForm.creditAccounts,
  },
  fieldName: undefined,
};

const otherSide = (side: Side): Side => (side === 'debit' ? 'credit' : 'debit');

export function useAccountSheet(): AccountSheet {
  const id = useId();
  const { show, ...dialog } = useModalDialog();
  const [side, setSide] = useState<Side>('debit');
  const [query, setQuery] = useState('');

  return {
    ...dialog,
    id,
    side,
    setSide,
    query,
    setQuery,
    openOn: (on, opener) => {
      if (show(opener)) {
        setSide(on);
        setQuery('');
      }
    },
  };
}

type AddAccountButtonProps = {
  readonly side: Side;
  readonly sheet: AccountSheet;
};

export function AddAccountButton({ side, sheet }: AddAccountButtonProps): ReactNode {
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-expanded={sheet.open}
      aria-controls={sheet.id}
      disabled={!hydrated}
      onClick={(event) => {
        sheet.openOn(side, event.currentTarget);
      }}
      className={`inline-flex h-10 items-center gap-1 self-start ${typeClasses['body-sm']} font-semibold ${SIDE_TONE[side].text} disabled:opacity-50 wide:hidden`}
    >
      <span aria-hidden="true">+</span>
      {en.accountSheet.add[side]}
    </button>
  );
}

type ChooseAccountButtonProps = {
  readonly side: Side;
  readonly account: AccountOutput | undefined;
  readonly sheet: AccountSheet;
};

export function ChooseAccountButton({ side, account, sheet }: ChooseAccountButtonProps): ReactNode {
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-label={en.accountSheet.choose[side]}
      aria-expanded={sheet.open}
      aria-controls={sheet.id}
      disabled={!hydrated}
      onClick={(event) => {
        sheet.openOn(side, event.currentTarget);
      }}
      className={`flex min-h-10 w-full items-center gap-3 border-t-2 py-1 text-left disabled:opacity-50 wide:hidden ${SIDE_TONE[side].edge}`}
    >
      <AccountRowContent side={side} account={account} placeholderInSideTone />
      {account === undefined ? null : (
        <span className="shrink-0 text-text-muted">
          <ChevronIcon />
        </span>
      )}
    </button>
  );
}

type AccountRowProps = {
  readonly side: Side;
  readonly account: AccountOutput | undefined;
};

export function AccountRow({ side, account }: AccountRowProps): ReactNode {
  return (
    <div className={`hidden items-center gap-3 border-t-2 py-1 wide:flex ${SIDE_TONE[side].edge}`}>
      <AccountRowContent side={side} account={account} placeholderInSideTone={false} />
    </div>
  );
}

type AccountRowContentProps = AccountRowProps & {
  readonly placeholderInSideTone: boolean;
};

function AccountRowContent({
  side,
  account,
  placeholderInSideTone,
}: AccountRowContentProps): ReactNode {
  const placeholderClass = placeholderInSideTone
    ? `font-semibold ${SIDE_TONE[side].text}`
    : 'text-text-muted';

  return (
    <>
      <span className={`w-16 shrink-0 ${typeClasses.label} leading-5 ${SIDE_TONE[side].text}`}>
        {en.sides[side]}
      </span>
      <span className={`min-w-0 grow ${account === undefined ? placeholderClass : 'font-semibold'}`}>
        {account === undefined ? en.entryForm.chooseAccount : account.name}
      </span>
    </>
  );
}

type SideChoicesProps = {
  readonly side: Side;
  readonly chart: ChartOutput;
  readonly control: PickControl;
  readonly matches: (account: AccountOutput) => boolean;
  readonly isChosen: (account: AccountId) => boolean;
  readonly onPick: (account: AccountOutput, chosen: boolean) => void;
  readonly onInvalid?: () => void;
  readonly look: ChoicesLook;
};

const FOCUSED_CHOICE =
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus';

const SHEET_CHOICE = `grow rounded px-2 py-1.5 text-text peer-checked:bg-accent/15 peer-checked:font-semibold ${FOCUSED_CHOICE}`;

const CHIP = `rounded border border-transparent px-1.5 py-1 text-text peer-checked:border-accent-text peer-checked:bg-surface peer-checked:font-semibold ${FOCUSED_CHOICE}`;

type ChoicesLook = {
  readonly sideNameShown: boolean;
  readonly groupName: string;
  readonly accounts: string;
  readonly groupAccounts: string;
  readonly tree: 'branches' | 'hook';
  readonly account: string;
  readonly choice: string;
};

const TYPE_BAND = `rounded bg-band px-2 py-1.5 ${typeClasses.label} font-medium text-text`;

const GROUP_NAME = 'flex items-center gap-1.5 pt-1 font-semibold';

const SHEET_LOOK: ChoicesLook = {
  sideNameShown: false,
  groupName: `${GROUP_NAME} px-2`,
  accounts: 'flex flex-col gap-1',
  groupAccounts: 'flex flex-col pl-1',
  tree: 'branches',
  account: 'relative flex',
  choice: SHEET_CHOICE,
};

const INLINE_ACCOUNTS = 'flex flex-wrap gap-x-3 gap-y-0.5';

const INLINE_LOOK: ChoicesLook = {
  sideNameShown: true,
  groupName: GROUP_NAME,
  accounts: INLINE_ACCOUNTS,
  groupAccounts: INLINE_ACCOUNTS,
  tree: 'hook',
  account: 'relative inline-flex',
  choice: CHIP,
};

type Run =
  | { readonly kind: 'accounts'; readonly accounts: readonly AccountOutput[] }
  | {
      readonly kind: 'group';
      readonly group: AccountGroupOutput;
      readonly accounts: readonly AccountOutput[];
    };

function runsOf(chart: ChartOutput, type: AccountType): readonly Run[] {
  const runs: Run[] = [];
  for (const node of nodesOfType(chart, type)) {
    const last = runs.at(-1);
    if (node.kind === 'group') {
      runs.push(node);
    } else if (last?.kind === 'accounts') {
      runs[runs.length - 1] = { kind: 'accounts', accounts: [...last.accounts, node.account] };
    } else {
      runs.push({ kind: 'accounts', accounts: [node.account] });
    }
  }
  return runs;
}

const NO_BRANCHES: ReadonlyMap<AccountId, Branch> = new Map();

type ChoiceProps = Pick<SideChoicesProps, 'side' | 'control' | 'look'> & {
  readonly onInvalid: (() => void) | undefined;
  readonly account: AccountOutput;
  readonly shown: boolean;
  readonly chosen: boolean;
  readonly branch: Branch | undefined;
  readonly onPick: (chosen: boolean) => void;
};

function Choice({
  side,
  account,
  control,
  shown,
  chosen,
  branch,
  onPick,
  onInvalid,
  look,
}: ChoiceProps): ReactNode {
  return (
    <label className={shown ? look.account : 'hidden'}>
      <input
        type={control.inputType}
        name={control.fieldName?.[side]}
        value={account.id}
        required={control.fieldName !== undefined}
        checked={chosen}
        onChange={(event) => {
          onPick(event.target.checked);
        }}
        onInvalid={onInvalid}
        className="peer absolute inset-0 m-0 appearance-none opacity-0"
      />
      {branch === undefined ? null : <TreeBranch branch={branch} />}
      <span className={look.choice}>{account.name}</span>
    </label>
  );
}

function SideChoices({
  side,
  chart,
  control,
  matches,
  isChosen,
  onPick,
  onInvalid,
  look,
}: SideChoicesProps): ReactNode {
  const typeId = useId();

  const choices = (
    accounts: readonly AccountOutput[],
    className: string,
    branches: ReadonlyMap<AccountId, Branch>,
  ): ReactNode => (
    <div className={className}>
      {accounts.map((account) => (
        <Choice
          key={account.id}
          side={side}
          account={account}
          control={control}
          shown={matches(account)}
          chosen={isChosen(account.id)}
          branch={branches.get(account.id)}
          onPick={(chosen) => {
            onPick(account, chosen);
          }}
          onInvalid={onInvalid}
          look={look}
        />
      ))}
    </div>
  );

  return (
    <div
      role={control.groupRole}
      aria-label={control.groupName[side]}
      className={`flex min-w-0 flex-col gap-2 border-t-2 ${SIDE_TONE[side].edge} px-3 pt-2 pb-3`}
    >
      {look.sideNameShown ? (
        <p aria-hidden="true" className={`${typeClasses.label} ${SIDE_TONE[side].text}`}>
          {en.sides[side]}
        </p>
      ) : null}
      {ACCOUNT_TYPES.map((type) => {
        const runs = runsOf(chart, type);
        return (
          <div
            key={type}
            role="group"
            aria-labelledby={`${typeId}-${type}`}
            className={
              runs.some((run) => run.accounts.some(matches)) ? 'flex flex-col gap-1' : 'hidden'
            }
          >
            <p id={`${typeId}-${type}`} className={TYPE_BAND}>
              {en.accountTypes[type]}
            </p>
            {runs.map((run, index) =>
              run.kind === 'accounts' ? (
                <Fragment key={`accounts-${String(index)}`}>
                  {choices(run.accounts, look.accounts, NO_BRANCHES)}
                </Fragment>
              ) : (
                <div
                  key={run.group.id}
                  className={run.accounts.some(matches) ? 'flex flex-col gap-1' : 'hidden'}
                >
                  <p className={look.groupName}>
                    <GroupFolder size={14} />
                    {run.group.name}
                  </p>
                  {look.tree === 'branches' ? (
                    choices(run.accounts, look.groupAccounts, branchesOf(run.accounts, matches))
                  ) : (
                    <div className="relative pl-4">
                      <TreeHook />
                      {choices(run.accounts, look.groupAccounts, NO_BRANCHES)}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

type FindAnAccountProps = {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly className?: string;
};

function FindAnAccount({ query, setQuery, className = '' }: FindAnAccountProps): ReactNode {
  return (
    <input
      type="search"
      aria-label={en.accountSheet.find}
      placeholder={en.accountSheet.find}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
      className={`${CONTROL} w-full ${className}`}
    />
  );
}

type NoMatchProps = {
  readonly query: string;
  readonly chart: ChartOutput;
  readonly matches: (account: AccountOutput) => boolean;
};

function NoMatch({ query, chart, matches }: NoMatchProps): ReactNode {
  return accountsIn(chart).some(matches) ? null : (
    <p className="px-4 py-3 text-text-muted">
      {en.accountSheet.noMatch} &quot;{query.trim()}&quot;.
    </p>
  );
}

const sideTone = (side: Side): string => `${SIDE_TONE[side].edge} ${SIDE_TONE[side].text}`;

function AccountColumns({
  id,
  chart,
  multiple = false,
  isChosen,
  onPick,
}: AccountPickerProps): ReactNode {
  const [shown, setShown] = useState<Side>('debit');
  const [query, setQuery] = useState('');
  const matches = nameContains(query);
  const tabId = (side: Side): string => `${id}-${side}-tab`;
  const panelId = (side: Side): string => `${id}-${side}-panel`;
  const hasAccount = (side: Side): boolean =>
    accountsIn(chart).some((account) => isChosen(side, account.id));

  return (
    <div
      className={`hidden min-w-0 flex-col overflow-hidden rounded border border-border bg-ground wide:flex ${typeClasses['body-dense']}`}
    >
      <div className="relative flex items-center border-b border-border bg-surface px-4 py-3">
        <span className="pointer-events-none absolute left-7 flex text-text-muted">
          <SearchIcon />
        </span>
        <FindAnAccount query={query} setQuery={setQuery} className="pl-8" />
      </div>
      <div className="split:hidden">
        <SheetTabs
          tabs={SIDES}
          shown={shown}
          onShow={setShown}
          tabId={tabId}
          panelId={panelId}
          label={(side) => en.sides[side]}
          shownTone={sideTone}
        />
      </div>
      <div className="grid split:grid-cols-2">
        {SIDES.map((side, index) => (
          <div
            key={side}
            id={panelId(side)}
            role="tabpanel"
            aria-labelledby={tabId(side)}
            className={`min-w-0 ${shown === side ? 'block' : 'hidden'} split:block ${index > 0 ? 'split:border-l split:border-border' : ''}`}
          >
            <SideChoices
              side={side}
              chart={chart}
              control={multiple ? PICK_MANY : PICK_ONE}
              matches={matches}
              look={INLINE_LOOK}
              isChosen={(account) => isChosen(side, account)}
              onPick={(account, chosen) => {
                onPick(side, account, chosen);
              }}
              onInvalid={() => {
                setShown(SIDES.find((missing) => !hasAccount(missing)) ?? side);
              }}
            />
          </div>
        ))}
      </div>
      <NoMatch query={query} chart={chart} matches={matches} />
    </div>
  );
}

function AccountSheetDialog({
  chart,
  multiple = false,
  isChosen,
  onPick,
  sheet,
}: AccountPickerProps): ReactNode {
  const tabId = (side: Side): string => `${sheet.id}-${side}-tab`;
  const panelId = (side: Side): string => `${sheet.id}-${side}-panel`;
  const titleId = `${sheet.id}-title`;
  const matches = nameContains(sheet.query);
  const hasAccount = (side: Side): boolean =>
    accountsIn(chart).some((account) => isChosen(side, account.id));

  const pick = (side: Side, account: AccountOutput, chosen: boolean): void => {
    onPick(side, account, chosen);
    if (multiple || !chosen) {
      return;
    }
    if (hasAccount(otherSide(side))) {
      sheet.close();
    } else {
      sheet.setSide(otherSide(side));
    }
  };

  return (
    <dialog
      {...sheet.dialogProps}
      id={sheet.id}
      aria-labelledby={titleId}
      onClick={sheet.closeOnScrim}
      className="mx-0 mt-auto mb-0 h-[calc(100%-4rem)] max-h-none w-full max-w-none rounded-t border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60"
    >
      <div className="flex h-full flex-col">
        <SheetBar titleId={titleId} title={en.accountSheet.title}>
          {multiple ? (
            <button type="button" onClick={sheet.close} className={PRIMARY_BUTTON}>
              {en.accountSheet.done}
            </button>
          ) : (
            <CloseButton label={en.accountSheet.close} onClose={sheet.close} />
          )}
        </SheetBar>
        <SheetTabs
          tabs={SIDES}
          shown={sheet.side}
          onShow={sheet.setSide}
          tabId={tabId}
          panelId={panelId}
          label={(side) => en.sides[side]}
        />
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
          <FindAnAccount query={sheet.query} setQuery={sheet.setQuery} />
        </div>
        <div className={`min-h-0 grow overflow-y-auto ${typeClasses['body-dense']}`}>
          {SIDES.map((side) => (
            <div
              key={side}
              id={panelId(side)}
              role="tabpanel"
              aria-labelledby={tabId(side)}
              className={sheet.side === side ? 'block' : 'hidden'}
            >
              <SideChoices
                side={side}
                chart={chart}
                control={multiple ? PICK_MANY : PICK_ONE}
                matches={matches}
                look={SHEET_LOOK}
                isChosen={(account) => isChosen(side, account)}
                onPick={(account, chosen) => {
                  pick(side, account, chosen);
                }}
                onInvalid={() => {
                  sheet.openOn(side, null);
                }}
              />
            </div>
          ))}
          <NoMatch query={sheet.query} chart={chart} matches={matches} />
        </div>
      </div>
    </dialog>
  );
}

function NoActiveAccount(): ReactNode {
  return (
    <p className={`rounded border border-border bg-ground px-4 py-3 ${typeClasses['body-dense']}`}>
      {en.accountSheet.noActiveAccount}{' '}
      <Link href={SETTINGS_PATH} className={LINK}>
        {en.accountSheet.settingsLink}
      </Link>
    </p>
  );
}

type OutsideActivePeriodProps = {
  readonly entry: PostedEntry | undefined;
  readonly offered: Offered;
};

export function OutsideActivePeriod({ entry, offered }: OutsideActivePeriodProps): ReactNode {
  const outside = [
    ...new Set(
      (entry?.lines ?? [])
        .filter((line) => !offered.ids.has(line.account))
        .map((line) => line.accountName),
    ),
  ];
  return outside.length === 0 ? null : (
    <p className={`min-w-0 text-danger ${typeClasses['body-dense']}`}>
      {en.accountSheet.outsideActivePeriod} {outside.join(', ')}.{' '}
      <Link href={SETTINGS_PATH} className={LINK}>
        {en.accountSheet.settingsLink}
      </Link>
    </p>
  );
}

export function AccountPicker(props: AccountPickerProps): ReactNode {
  const wide = useWide();
  if (accountsIn(props.chart).length === 0) {
    return <NoActiveAccount />;
  }
  return wide ? <AccountColumns {...props} /> : <AccountSheetDialog {...props} />;
}
