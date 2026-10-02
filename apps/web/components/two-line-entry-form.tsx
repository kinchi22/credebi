'use client';

import { entryFormModeSchema, sideSchema, type Side } from '@repo/contracts';
import { type AccountCode } from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountPicker,
  AddAccountButton,
  useAccountSheet,
  type AccountChoice,
} from './account-picker';
import { DENSE_FIELD } from './control-classes';
import { SIDE_TONE } from './side-classes';
import {
  AmountInput,
  EntryFormShell,
  type EntryFormParts,
  type EntryFormProps,
} from './entry-form';

const NOTHING_CHOSEN: AccountChoice = { debit: undefined, credit: undefined };

function TwoLineFields({ id, heading, refusal, submitButton }: EntryFormParts): ReactNode {
  const [chosen, setChosen] = useState<AccountChoice>(NOTHING_CHOSEN);
  const sheet = useAccountSheet();

  const choose = (side: Side, account: AccountCode): void => {
    setChosen((current) => ({ ...current, [side]: account }));
  };

  const isChosen = (side: Side, account: AccountCode): boolean => chosen[side] === account;

  return (
    <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <dl className={`flex flex-col ${typeClasses['body-dense']}`}>
          {sideSchema.options.map((side) => {
            const account = chosen[side];
            return (
              <div key={side} className="flex items-center gap-3 border-b border-border py-1">
                <dt className={`w-16 shrink-0 ${typeClasses.label} leading-5 ${SIDE_TONE[side].text}`}>
                  {en.sides[side]}
                </dt>
                <dd className="flex min-w-0 grow flex-wrap items-center justify-between gap-x-3">
                  <span className={account === undefined ? 'text-text-muted' : 'font-semibold'}>
                    {account === undefined ? en.entryForm.chooseAccount : en.accounts[account]}
                  </span>
                  <AddAccountButton side={side} sheet={sheet} />
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="flex items-end gap-3">
          <div className={`${DENSE_FIELD} min-w-0 grow`}>
            <label htmlFor={`${id}-amount`}>{en.twoLineForm.amount}</label>
            <AmountInput id={`${id}-amount`} />
          </div>
          {submitButton}
        </div>
        {refusal}
      </div>
      <AccountPicker id={id} isChosen={isChosen} onPick={choose} sheet={sheet} />
    </div>
  );
}

export function TwoLineEntryForm({ action }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} mode={entryFormModeSchema.enum['two-line']}>
      {(parts) => <TwoLineFields {...parts} />}
    </EntryFormShell>
  );
}
