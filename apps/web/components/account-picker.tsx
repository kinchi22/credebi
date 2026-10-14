'use client';

import { useTranslations } from 'next-intl';
import {
  ENTRY_FORM_FIELDS,
  accountsIn,
  type AccountId,
  type AccountOutput,
  type ChartOutput,
  type Side,
} from '@repo/contracts';
import { ACCOUNT_TYPES } from '@repo/core/accounts';
import { ChevronIcon, SearchIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { SETTINGS_PATH } from '../server/return-path';
import { CONTROL, PRIMARY_BUTTON, SEARCH_ON_STRIP } from './control-classes';
import { useHydrated } from './hydrated';
import { useModalDialog, type ModalDialog } from './modal-dialog';
import {
  branchesOf,
  nameContains,
  offersAGroup,
  ruledRunsOf,
  runsOf,
  type Branch,
  type GroupRules,
  type Run,
} from './chart-tree';
import { CloseButton } from './close-button';
import { SheetBar, SheetTabs } from './sheet';
import { SIDE_TONE, SIDES } from './side-classes';
import { NOTHING_SUGGESTED, type Suggested } from './suggested-accounts';
import { LINK } from './text-classes';
import { GroupFolder, TreeBranch } from './tree-branch';
import { Band, SuggestedBand } from './type-band';
import { useWide } from './wide';

export type AccountChoice = Readonly<Record<Side, AccountOutput | undefined>>;

export type AccountPickerProps = {
  readonly id: string;
  readonly chart: ChartOutput;
  readonly multiple?: boolean;
  readonly isChosen: (side: Side, account: AccountId) => boolean;
  readonly onPick: (side: Side, account: AccountOutput, chosen: boolean) => void;
  readonly suggested: Suggested;
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

type MessageKey = Parameters<ReturnType<typeof useTranslations<never>>>[0];

type PickControl = {
  readonly groupRole: 'radiogroup' | 'group';
  readonly inputType: 'radio' | 'checkbox';
  readonly groupName: Readonly<Record<Side, MessageKey>>;
  readonly fieldName: Readonly<Record<Side, string>> | undefined;
};

const PICK_ONE: PickControl = {
  groupRole: 'radiogroup',
  inputType: 'radio',
  groupName: { debit: 'twoLineForm.debitAccount', credit: 'twoLineForm.creditAccount' },
  fieldName: {
    debit: ENTRY_FORM_FIELDS.debitAccount,
    credit: ENTRY_FORM_FIELDS.creditAccount,
  },
};

const PICK_MANY: PickControl = {
  groupRole: 'group',
  inputType: 'checkbox',
  groupName: {
    debit: 'multiLineForm.debitAccounts',
    credit: 'multiLineForm.creditAccounts',
  },
  fieldName: undefined,
};

const asSuggestion = (control: PickControl): PickControl => ({ ...control, fieldName: undefined });

const suggestedFor = (query: string, suggested: Suggested): Suggested =>
  query.trim() === '' ? suggested : NOTHING_SUGGESTED;

const otherSide = (side: Side): Side => (side === 'debit' ? 'credit' : 'debit');

const otherSideMissing = (side: Side, hasAccount: (side: Side) => boolean): Side | undefined =>
  hasAccount(otherSide(side)) ? undefined : otherSide(side);

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
  const t = useTranslations();
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
      {t(`accountSheet.add.${side}`)}
    </button>
  );
}

type ChooseAccountButtonProps = {
  readonly side: Side;
  readonly account: AccountOutput | undefined;
  readonly sheet: AccountSheet;
};

export function ChooseAccountButton({ side, account, sheet }: ChooseAccountButtonProps): ReactNode {
  const t = useTranslations();
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-label={t(`accountSheet.choose.${side}`)}
      aria-expanded={sheet.open}
      aria-controls={sheet.id}
      disabled={!hydrated}
      onClick={(event) => {
        sheet.openOn(side, event.currentTarget);
      }}
      className={`flex min-h-10 w-full items-center ${ACCOUNT_ROW_GAP} border-t-2 py-3 text-left disabled:opacity-50 wide:hidden ${SIDE_TONE[side].edge}`}
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
    <div className={`hidden items-center ${ACCOUNT_ROW_GAP} border-t-2 py-3 wide:flex ${SIDE_TONE[side].edge}`}>
      <AccountRowContent side={side} account={account} placeholderInSideTone={false} />
    </div>
  );
}

const ACCOUNT_ROW_GAP = 'gap-3';

const SIDE_NAME_COLUMN = 'w-16 shrink-0';

type UnderAccountNameProps = {
  readonly children: ReactNode;
};

export function UnderAccountName({ children }: UnderAccountNameProps): ReactNode {
  return (
    <div className={`-mt-2 flex pb-3 ${ACCOUNT_ROW_GAP}`}>
      <span aria-hidden="true" className={SIDE_NAME_COLUMN} />
      <div className="min-w-0 grow">{children}</div>
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
  const t = useTranslations();
  const placeholderClass = placeholderInSideTone
    ? `font-semibold ${SIDE_TONE[side].text}`
    : 'text-text-muted';

  return (
    <>
      <span className={`${SIDE_NAME_COLUMN} ${typeClasses.label} leading-5 ${SIDE_TONE[side].text}`}>
        {t(`sides.${side}`)}
      </span>
      <span className={`min-w-0 grow wrap-anywhere ${account === undefined ? placeholderClass : 'font-semibold'}`}>
        {account === undefined ? t('entryForm.chooseAccount') : account.name}
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
  readonly suggested: readonly AccountOutput[];
  readonly look: ChoicesLook;
};

const FOCUSED_CHOICE =
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus';

const SHEET_CHOICE = `grow rounded-control px-2 py-1.5 wrap-anywhere text-text peer-checked:bg-accent/15 peer-checked:font-semibold ${FOCUSED_CHOICE}`;

const CHIP = `rounded-control border border-border px-1.5 py-1 wrap-anywhere text-text peer-not-checked:peer-hover:border-border-control peer-checked:border-accent-text peer-checked:bg-surface-chosen peer-checked:font-medium ${FOCUSED_CHOICE}`;

type ChoicesLook = {
  readonly sideNameShown: boolean;
  readonly groups: 'tree' | 'captions';
  readonly accounts: string;
  readonly account: string;
  readonly choice: string;
};

const SHEET_LOOK: ChoicesLook = {
  sideNameShown: false,
  groups: 'tree',
  accounts: 'flex flex-col gap-1',
  account: 'relative flex',
  choice: SHEET_CHOICE,
};

const INLINE_LOOK: ChoicesLook = {
  sideNameShown: true,
  groups: 'captions',
  accounts: 'flex min-w-0 flex-wrap content-start gap-x-3 gap-y-0.5',
  account: 'relative inline-flex',
  choice: CHIP,
};

const SHEET_GROUP_NAME = 'flex items-center gap-1.5 px-2 pt-1 font-semibold wrap-anywhere';

const CAPTION_ROW = 'grid grid-cols-[84px_minmax(0,1fr)] gap-x-2.5';

const UNGROUPED = 'py-1.5';

const GROUP_CAPTION = 'leading-7.5 font-medium wrap-anywhere text-text-muted';

const groupBounds = ({ above, below }: GroupRules): string =>
  `border-dashed border-border-control/55 ${above ? 'border-t' : ''} ${below ? 'border-b' : ''}`;

const BAND_PADDING = 'px-2 py-1.5';

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
  suggested,
  look,
}: SideChoicesProps): ReactNode {
  const t = useTranslations();
  const typeId = useId();

  const choices = (
    accounts: readonly AccountOutput[],
    className: string,
    branches: ReadonlyMap<AccountId, Branch>,
    pickControl: PickControl = control,
  ): ReactNode => (
    <div className={className}>
      {accounts.map((account) => (
        <Choice
          key={account.id}
          side={side}
          account={account}
          control={pickControl}
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

  const isShown = (run: Run): boolean => run.accounts.some(matches);

  const shownIn = (run: Run): string => (isShown(run) ? '' : 'hidden');

  const treeOf = (runs: readonly Run[]): ReactNode =>
    runs.map((run, index) =>
      run.kind === 'accounts' ? (
        <Fragment key={`accounts-${String(index)}`}>
          {choices(run.accounts, look.accounts, NO_BRANCHES)}
        </Fragment>
      ) : (
        <div key={run.group.id} className={`flex flex-col gap-1 ${shownIn(run)}`}>
          <p className={SHEET_GROUP_NAME}>
            <GroupFolder size={14} />
            {run.group.name}
          </p>
          {choices(run.accounts, 'flex flex-col pl-1', branchesOf(run.accounts, matches))}
        </div>
      ),
    );

  const captionsOf = (runs: readonly Run[]): ReactNode =>
    offersAGroup(runs) ? (
      <div className="flex flex-col">
        {ruledRunsOf(runs, matches).map(({ run, rules }, index) =>
          run.kind === 'accounts' ? (
            <div
              key={`accounts-${String(index)}`}
              className={`${CAPTION_ROW} ${UNGROUPED} ${shownIn(run)}`}
            >
              <span />
              {choices(run.accounts, look.accounts, NO_BRANCHES)}
            </div>
          ) : (
            <div
              key={run.group.id}
              className={`${CAPTION_ROW} py-2 ${groupBounds(rules)} ${shownIn(run)}`}
            >
              <p className={GROUP_CAPTION}>{run.group.name}</p>
              {choices(run.accounts, look.accounts, NO_BRANCHES)}
            </div>
          ),
        )}
      </div>
    ) : (
      <div className={UNGROUPED}>
        {choices(
          runs.flatMap((run) => run.accounts),
          look.accounts,
          NO_BRANCHES,
        )}
      </div>
    );

  return (
    <div
      role={control.groupRole}
      aria-label={t(control.groupName[side])}
      className={`flex min-w-0 flex-col gap-2 border-t-2 ${SIDE_TONE[side].edge} px-3 pt-2 pb-3`}
    >
      {look.sideNameShown ? (
        <p aria-hidden="true" className={`${typeClasses.label} ${SIDE_TONE[side].text}`}>
          {t(`sides.${side}`)}
        </p>
      ) : null}
      {suggested.length === 0 ? null : (
        <div role="group" aria-labelledby={`${typeId}-suggested`} className="flex flex-col gap-1">
          <SuggestedBand id={`${typeId}-suggested`} className={BAND_PADDING} />
          <div className={look.groups === 'tree' ? '' : UNGROUPED}>
            {choices(suggested, look.accounts, NO_BRANCHES, asSuggestion(control))}
          </div>
        </div>
      )}
      {ACCOUNT_TYPES.map((type) => {
        const runs = runsOf(chart, type);
        return (
          <div
            key={type}
            role="group"
            aria-labelledby={`${typeId}-${type}`}
            className={runs.some(isShown) ? 'flex flex-col gap-1' : 'hidden'}
          >
            <Band accountType={type} id={`${typeId}-${type}`} className={BAND_PADDING} />
            {look.groups === 'tree' ? treeOf(runs) : captionsOf(runs)}
          </div>
        );
      })}
    </div>
  );
}

type FindAnAccountProps = {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly className: string;
};

function FindAnAccount({ query, setQuery, className }: FindAnAccountProps): ReactNode {
  const t = useTranslations();
  return (
    <input
      type="search"
      aria-label={t('accountSheet.find')}
      placeholder={t('accountSheet.find')}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
      className={`w-full ${className}`}
    />
  );
}

type NoMatchProps = {
  readonly query: string;
  readonly chart: ChartOutput;
  readonly matches: (account: AccountOutput) => boolean;
};

function NoMatch({ query, chart, matches }: NoMatchProps): ReactNode {
  const t = useTranslations();
  return accountsIn(chart).some(matches) ? null : (
    <p className="px-4 py-3 text-text-muted">
      {t('accountSheet.noMatch')} &quot;{query.trim()}&quot;.
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
  suggested,
}: AccountPickerProps): ReactNode {
  const t = useTranslations();
  const [shown, setShown] = useState<Side>('debit');
  const [query, setQuery] = useState('');
  const matches = nameContains(query);
  const tabId = (side: Side): string => `${id}-${side}-tab`;
  const panelId = (side: Side): string => `${id}-${side}-panel`;
  const hasAccount = (side: Side): boolean =>
    accountsIn(chart).some((account) => isChosen(side, account.id));

  const pick = (side: Side, account: AccountOutput, chosen: boolean): void => {
    onPick(side, account, chosen);
    if (multiple || !chosen) {
      return;
    }
    const missing = otherSideMissing(side, hasAccount);
    if (missing !== undefined) {
      setShown(missing);
    }
  };

  return (
    <div
      className={`hidden min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-ground shadow-lift wide:flex ${typeClasses['body-dense']}`}
    >
      <div className="relative flex items-center border-b border-border bg-surface px-4 py-3">
        <span className="pointer-events-none absolute left-7 flex text-text-muted">
          <SearchIcon size={16} />
        </span>
        <FindAnAccount query={query} setQuery={setQuery} className={`${SEARCH_ON_STRIP} pl-8`} />
      </div>
      <div className="split:hidden">
        <SheetTabs
          tabs={SIDES}
          shown={shown}
          onShow={setShown}
          tabId={tabId}
          panelId={panelId}
          label={(side) => t(`sides.${side}`)}
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
              suggested={suggestedFor(query, suggested)[side]}
              look={INLINE_LOOK}
              isChosen={(account) => isChosen(side, account)}
              onPick={(account, chosen) => {
                pick(side, account, chosen);
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
  suggested,
  sheet,
}: AccountPickerProps): ReactNode {
  const t = useTranslations();
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
    const missing = otherSideMissing(side, hasAccount);
    if (missing === undefined) {
      sheet.close();
    } else {
      sheet.setSide(missing);
    }
  };

  return (
    <dialog
      {...sheet.dialogProps}
      id={sheet.id}
      aria-labelledby={titleId}
      onClick={sheet.closeOnScrim}
      className="mx-0 mt-auto mb-0 h-[calc(100%-4rem)] max-h-none w-full max-w-none rounded-t-panel border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60"
    >
      <div className="flex h-full flex-col">
        <SheetBar titleId={titleId} title={t('accountSheet.title')}>
          {multiple ? (
            <button type="button" onClick={sheet.close} className={PRIMARY_BUTTON}>
              {t('accountSheet.done')}
            </button>
          ) : (
            <CloseButton label={t('accountSheet.close')} onClose={sheet.close} />
          )}
        </SheetBar>
        <SheetTabs
          tabs={SIDES}
          shown={sheet.side}
          onShow={sheet.setSide}
          tabId={tabId}
          panelId={panelId}
          label={(side) => t(`sides.${side}`)}
        />
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
          <FindAnAccount query={sheet.query} setQuery={sheet.setQuery} className={CONTROL} />
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
                suggested={suggestedFor(sheet.query, suggested)[side]}
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
  const t = useTranslations();
  return (
    <p className={`rounded-panel border border-border bg-ground px-4 py-3 ${typeClasses['body-dense']}`}>
      {t('accountSheet.noActiveAccount')}{' '}
      <Link href={SETTINGS_PATH} className={LINK}>
        {t('accountSheet.settingsLink')}
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
