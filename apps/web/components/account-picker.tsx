'use client';

import { ENTRY_FORM_FIELDS, type Side } from '@repo/contracts';
import {
  ACCOUNT_TYPE_OF,
  CHART_OF_ACCOUNTS,
  accountTypesInOrder,
  type AccountCode,
} from '@repo/core/entries';
import { ChevronIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { CONTROL, PRIMARY_BUTTON } from './control-classes';
import { useHydrated } from './hydrated';
import { useModalDialog, type ModalDialog } from './modal-dialog';
import { SheetBar, SheetCloseButton, SheetTabs } from './sheet';
import { SIDE_TONE, SIDES } from './side-classes';
import { useWide } from './wide';

export type AccountChoice = Readonly<Record<Side, AccountCode | undefined>>;

export type AccountPickerProps = {
  readonly id: string;
  readonly multiple?: boolean;
  readonly isChosen: (side: Side, account: AccountCode) => boolean;
  readonly onPick: (side: Side, account: AccountCode, chosen: boolean) => void;
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

const matchesEveryAccount = (): boolean => true;

const nameContains =
  (query: string) =>
  (account: AccountCode): boolean =>
    en.accounts[account].toLowerCase().includes(query.trim().toLowerCase());

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
  readonly account: AccountCode | undefined;
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
      className="flex min-h-10 w-full items-center gap-3 border-b border-border py-1 text-left disabled:opacity-50 wide:hidden"
    >
      <AccountRowContent side={side} account={account} />
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
  readonly account: AccountCode | undefined;
};

export function AccountRow({ side, account }: AccountRowProps): ReactNode {
  return (
    <div className="hidden items-center gap-3 border-b border-border py-1 wide:flex">
      <AccountRowContent side={side} account={account} />
    </div>
  );
}

function AccountRowContent({ side, account }: AccountRowProps): ReactNode {
  return (
    <>
      <span className={`w-16 shrink-0 ${typeClasses.label} leading-5 ${SIDE_TONE[side].text}`}>
        {en.sides[side]}
      </span>
      <span className={`min-w-0 grow ${account === undefined ? 'text-text-muted' : 'font-semibold'}`}>
        {account === undefined ? en.entryForm.chooseAccount : en.accounts[account]}
      </span>
    </>
  );
}

type SideChoicesProps = {
  readonly id: string;
  readonly side: Side;
  readonly control: PickControl;
  readonly matches: (account: AccountCode) => boolean;
  readonly isChosen: (account: AccountCode) => boolean;
  readonly onPick: (account: AccountCode, chosen: boolean) => void;
  readonly onInvalid?: () => void;
  readonly nameShown: boolean;
};

function SideChoices({
  id,
  side,
  control,
  matches,
  isChosen,
  onPick,
  onInvalid,
  nameShown,
}: SideChoicesProps): ReactNode {
  const choicesId = `${id}-${side}-accounts`;

  return (
    <div
      role={control.groupRole}
      aria-labelledby={`${choicesId}-name`}
      className={`flex min-w-0 flex-col gap-2 border-t-2 ${SIDE_TONE[side].edge} px-3 pt-2 pb-3`}
    >
      <p
        id={`${choicesId}-name`}
        className={nameShown ? `${typeClasses.label} text-text-muted` : 'sr-only'}
      >
        {control.groupName[side]}
      </p>
      {accountTypesInOrder(side).map((type) => {
        const accounts = CHART_OF_ACCOUNTS.filter((code) => ACCOUNT_TYPE_OF[code] === type);
        return (
          <div
            key={type}
            role="group"
            aria-labelledby={`${choicesId}-${type}`}
            className={accounts.some(matches) ? 'flex flex-col gap-1' : 'hidden'}
          >
            <p id={`${choicesId}-${type}`} className={`${typeClasses.label} text-text-muted`}>
              {en.accountTypes[type]}
            </p>
            {accounts.map((code) => (
              <label key={code} className={matches(code) ? 'relative flex' : 'hidden'}>
                <input
                  type={control.inputType}
                  name={control.fieldName?.[side]}
                  value={code}
                  required={control.fieldName !== undefined}
                  checked={isChosen(code)}
                  onChange={(event) => {
                    onPick(code, event.target.checked);
                  }}
                  onInvalid={onInvalid}
                  className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
                />
                <span className="grow rounded px-2 py-1 text-text peer-checked:bg-accent/15 peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                  {en.accounts[code]}
                </span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AccountColumns({ id, multiple = false, isChosen, onPick }: AccountPickerProps): ReactNode {
  return (
    <div className={`hidden min-w-0 grid-cols-2 rounded border border-border bg-ground wide:grid ${typeClasses['body-dense']}`}>
      {SIDES.map((side) => (
        <SideChoices
          key={side}
          id={id}
          side={side}
          control={multiple ? PICK_MANY : PICK_ONE}
          matches={matchesEveryAccount}
          nameShown
          isChosen={(account) => isChosen(side, account)}
          onPick={(account, chosen) => {
            onPick(side, account, chosen);
          }}
        />
      ))}
    </div>
  );
}

function AccountSheetDialog({ multiple = false, isChosen, onPick, sheet }: AccountPickerProps): ReactNode {
  const tabId = (side: Side): string => `${sheet.id}-${side}-tab`;
  const panelId = (side: Side): string => `${sheet.id}-${side}-panel`;
  const titleId = `${sheet.id}-title`;
  const matches = nameContains(sheet.query);
  const hasAccount = (side: Side): boolean =>
    CHART_OF_ACCOUNTS.some((account) => isChosen(side, account));

  const pick = (side: Side, account: AccountCode, chosen: boolean): void => {
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
            <SheetCloseButton label={en.accountSheet.close} onClose={sheet.close} />
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
          <input
            type="search"
            aria-label={en.accountSheet.find}
            placeholder={en.accountSheet.find}
            value={sheet.query}
            onChange={(event) => {
              sheet.setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            className={`${CONTROL} w-full`}
          />
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
                id={sheet.id}
                side={side}
                control={multiple ? PICK_MANY : PICK_ONE}
                matches={matches}
                nameShown={false}
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
          {CHART_OF_ACCOUNTS.some(matches) ? null : (
            <p className="px-4 py-3 text-text-muted">
              {en.accountSheet.noMatch} &quot;{sheet.query.trim()}&quot;.
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function AccountPicker(props: AccountPickerProps): ReactNode {
  return useWide() ? <AccountColumns {...props} /> : <AccountSheetDialog {...props} />;
}
