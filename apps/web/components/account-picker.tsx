'use client';

import { ENTRY_FORM_FIELDS, sideSchema, type Side } from '@repo/contracts';
import {
  ACCOUNT_TYPE,
  CHART_OF_ACCOUNTS,
  accountTypesInOrder,
  type AccountCode,
} from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { en } from '../messages/en';

export type AccountChoice = Readonly<Record<Side, AccountCode | undefined>>;

export type AccountPickerProps = {
  readonly id: string;
  readonly chosen: AccountChoice;
  readonly onChoose: (side: Side, account: AccountCode) => void;
};

const SIDES: readonly Side[] = sideSchema.options;

const FIELD_NAME: Readonly<Record<Side, string>> = {
  debit: ENTRY_FORM_FIELDS.debitAccount,
  credit: ENTRY_FORM_FIELDS.creditAccount,
};

const CHOICES_NAME: Readonly<Record<Side, string>> = {
  debit: en.twoLineForm.debitAccount,
  credit: en.twoLineForm.creditAccount,
};

const SIDE_EDGE: Readonly<Record<Side, string>> = {
  debit: 'border-debit',
  credit: 'border-credit',
};

const otherSide = (side: Side): Side => (side === 'debit' ? 'credit' : 'debit');

type SideChoicesProps = {
  readonly id: string;
  readonly side: Side;
  readonly shown: boolean;
  readonly chosen: AccountCode | undefined;
  readonly onChoose: (account: AccountCode) => void;
  readonly onInvalid: () => void;
};

function SideChoices({ id, side, shown, chosen, onChoose, onInvalid }: SideChoicesProps): ReactNode {
  const choicesId = `${id}-${side}-accounts`;

  return (
    <div
      id={choicesId}
      role="radiogroup"
      aria-labelledby={`${choicesId}-name`}
      className={`${shown ? 'flex' : 'hidden'} min-w-0 flex-col gap-2 border-t-2 ${SIDE_EDGE[side]} px-3 pt-2 pb-3 wide:flex`}
    >
      <p id={`${choicesId}-name`} className={`${typeClasses.label} text-text-muted`}>
        {CHOICES_NAME[side]}
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
          {CHART_OF_ACCOUNTS.filter((code) => ACCOUNT_TYPE[code] === type).map((code) => (
            <label key={code} className="relative flex">
              <input
                type="radio"
                name={FIELD_NAME[side]}
                value={code}
                required
                checked={chosen === code}
                onChange={() => {
                  onChoose(code);
                }}
                onInvalid={onInvalid}
                className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
              />
              <span className="grow rounded border border-transparent px-2 py-1 text-text peer-checked:border-accent-text peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-accent-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                {en.accounts[code]}
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AccountPicker({ id, chosen, onChoose }: AccountPickerProps): ReactNode {
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
            ref={(element) => {
              tabs.current[side] = element;
            }}
            type="button"
            role="tab"
            aria-selected={shown === side}
            aria-controls={`${id}-${side}-accounts`}
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
          <SideChoices
            key={side}
            id={id}
            side={side}
            shown={shown === side}
            chosen={chosen[side]}
            onChoose={(account) => {
              onChoose(side, account);
            }}
            onInvalid={() => {
              setShown(side);
            }}
          />
        ))}
      </div>
    </div>
  );
}
