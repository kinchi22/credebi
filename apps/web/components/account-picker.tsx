'use client';

import { ENTRY_FORM_FIELDS, type Side } from '@repo/contracts';
import {
  ACCOUNT_TYPE_OF,
  CHART_OF_ACCOUNTS,
  accountTypesInOrder,
  type AccountCode,
} from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { en } from '../messages/en';
import { SIDE_TONE, SIDES } from './side-classes';

export type AccountChoice = Readonly<Record<Side, AccountCode | undefined>>;

export type AccountPickerProps = {
  readonly id: string;
  readonly multiple?: boolean;
  readonly isChosen: (side: Side, account: AccountCode) => boolean;
  readonly onPick: (side: Side, account: AccountCode, chosen: boolean) => void;
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

type SideChoicesProps = {
  readonly id: string;
  readonly side: Side;
  readonly control: PickControl;
  readonly isChosen: (account: AccountCode) => boolean;
  readonly onPick: (account: AccountCode, chosen: boolean) => void;
  readonly onInvalid: () => void;
};

function SideChoices({
  id,
  side,
  control,
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
      {accountTypesInOrder(side).map((type) => (
        <div
          key={type}
          role="group"
          aria-labelledby={`${choicesId}-${type}`}
          className="flex flex-col gap-1"
        >
          <p id={`${choicesId}-${type}`} className={`${typeClasses.label} text-text-muted`}>
            {en.accountTypes[type]}
          </p>
          {CHART_OF_ACCOUNTS.filter((code) => ACCOUNT_TYPE_OF[code] === type).map((code) => (
            <label key={code} className="relative flex">
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
      ))}
    </div>
  );
}

export function AccountPicker({ id, multiple = false, isChosen, onPick }: AccountPickerProps): ReactNode {
  const [shown, setShown] = useState<Side>('debit');
  const tabs = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({});

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, side: Side): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const next = otherSide(side);
    setShown(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className={`flex min-w-0 flex-col rounded border border-border bg-ground ${typeClasses['body-dense']}`}>
      <div role="tablist" className="flex border-b border-border wide:hidden">
        {SIDES.map((side) => (
          <button
            key={side}
            id={`${id}-${side}-tab`}
            ref={(element) => {
              tabs.current[side] = element;
            }}
            type="button"
            role="tab"
            aria-selected={shown === side}
            aria-controls={`${id}-${side}-panel`}
            tabIndex={shown === side ? 0 : -1}
            onClick={() => {
              setShown(side);
            }}
            onKeyDown={(event) => {
              moveTab(event, side);
            }}
            className="flex-1 px-3 py-2 text-text-muted aria-selected:font-semibold aria-selected:text-text"
          >
            {en.sides[side]}
          </button>
        ))}
      </div>
      <div className="grid wide:grid-cols-2">
        {SIDES.map((side) => (
          <div
            key={side}
            id={`${id}-${side}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-${side}-tab`}
            className={`${shown === side ? 'block' : 'hidden'} min-w-0 wide:block`}
          >
            <SideChoices
              id={id}
              side={side}
              control={multiple ? PICK_MANY : PICK_ONE}
              isChosen={(account) => isChosen(side, account)}
              onPick={(account, chosen) => {
                onPick(side, account, chosen);
              }}
              onInvalid={() => {
                setShown(side);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
