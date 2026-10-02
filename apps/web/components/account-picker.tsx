'use client';

import { ENTRY_FORM_FIELDS, type Side } from '@repo/contracts';
import {
  ACCOUNT_TYPE_OF,
  CHART_OF_ACCOUNTS,
  accountTypesInOrder,
  type AccountCode,
} from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { CONTROL, PRIMARY_BUTTON } from './control-classes';
import { useModalDialog, type ModalDialog } from './modal-dialog';
import { SheetTabs } from './sheet-tabs';
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

export type AccountSheet = {
  readonly dialog: ModalDialog;
  readonly shown: Side;
  readonly show: (side: Side) => void;
  readonly query: string;
  readonly find: (query: string) => void;
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

const EVERY_ACCOUNT = (): boolean => true;

const nameContains =
  (query: string) =>
  (account: AccountCode): boolean =>
    en.accounts[account].toLowerCase().includes(query.trim().toLowerCase());

export function useAccountSheet(): AccountSheet {
  const dialog = useModalDialog();
  const [shown, show] = useState<Side>('debit');
  const [query, find] = useState('');

  return {
    dialog,
    shown,
    show,
    query,
    find,
    openOn: (side, opener) => {
      if (dialog.show(opener)) {
        show(side);
        find('');
      }
    },
  };
}

type AddAccountButtonProps = {
  readonly side: Side;
  readonly sheet: AccountSheet;
};

export function AddAccountButton({ side, sheet }: AddAccountButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={(event) => {
        sheet.openOn(side, event.currentTarget);
      }}
      className={`inline-flex h-10 items-center gap-1 self-start ${typeClasses['body-sm']} font-semibold ${SIDE_TONE[side].text} wide:hidden`}
    >
      <span aria-hidden="true">+</span>
      {en.accountSheet.add[side]}
    </button>
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
};

function SideChoices({
  id,
  side,
  control,
  matches,
  isChosen,
  onPick,
  onInvalid,
}: SideChoicesProps): ReactNode {
  const choicesId = `${id}-${side}-accounts`;

  return (
    <div
      role={control.groupRole}
      aria-labelledby={`${choicesId}-name`}
      className={`flex min-w-0 flex-col gap-2 border-t-2 ${SIDE_TONE[side].edge} px-3 pt-2 pb-3`}
    >
      <p id={`${choicesId}-name`} className={`${typeClasses.label} text-text-muted`}>
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
          matches={EVERY_ACCOUNT}
          isChosen={(account) => isChosen(side, account)}
          onPick={(account, chosen) => {
            onPick(side, account, chosen);
          }}
        />
      ))}
    </div>
  );
}

function AccountSheetDialog({ id, multiple = false, isChosen, onPick, sheet }: AccountPickerProps): ReactNode {
  const sheetId = `${id}-account-sheet`;
  const tabId = (side: Side): string => `${sheetId}-${side}-tab`;
  const panelId = (side: Side): string => `${sheetId}-${side}-panel`;
  const hasAccount = (side: Side): boolean =>
    CHART_OF_ACCOUNTS.some((account) => isChosen(side, account));

  const pick = (side: Side, account: AccountCode, chosen: boolean): void => {
    onPick(side, account, chosen);
    if (chosen && !hasAccount(otherSide(side))) {
      sheet.show(otherSide(side));
    }
  };

  return (
    <dialog
      {...sheet.dialog.dialogProps}
      id={sheetId}
      aria-labelledby={`${sheetId}-title`}
      className="mx-0 mt-auto mb-0 h-[calc(100%-4rem)] max-h-none w-full max-w-none rounded-t border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
          <h2 id={`${sheetId}-title`} className={`${typeClasses.body} font-semibold`}>
            {en.accountSheet.title}
          </h2>
          <button type="button" onClick={sheet.dialog.close} className={PRIMARY_BUTTON}>
            {en.accountSheet.done}
          </button>
        </div>
        <SheetTabs
          tabs={SIDES}
          shown={sheet.shown}
          onShow={sheet.show}
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
              sheet.find(event.target.value);
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
              className={sheet.shown === side ? 'block' : 'hidden'}
            >
              <SideChoices
                id={sheetId}
                side={side}
                control={multiple ? PICK_MANY : PICK_ONE}
                matches={nameContains(sheet.query)}
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
        </div>
      </div>
    </dialog>
  );
}

export function AccountPicker(props: AccountPickerProps): ReactNode {
  return useWide() ? <AccountColumns {...props} /> : <AccountSheetDialog {...props} />;
}
