'use client';

import { entryFormModeSchema, sideSchema, type Side } from '@repo/contracts';
import { type AccountCode } from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { AccountPicker, type AccountChoice } from './account-picker';
import { DENSE_FIELD } from './control-classes';
import { SIDE_TONE } from './side-classes';
import {
  AmountInput,
  EntryFormShell,
  type EntryFormParts,
  type EntryFormProps,
} from './entry-form';

const NOTHING_CHOSEN: AccountChoice = { debit: undefined, credit: undefined };

function TwoLineFields({ id, heading, footer }: EntryFormParts): ReactNode {
  const [chosen, setChosen] = useState<AccountChoice>(NOTHING_CHOSEN);

  const choose = (side: Side, account: AccountCode): void => {
    setChosen((current) => ({ ...current, [side]: account }));
  };

  return (
    <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <dl className={`flex flex-col ${typeClasses['body-dense']}`}>
          {sideSchema.options.map((side) => {
            const account = chosen[side];
            return (
              <div key={side} className="flex gap-3 border-b border-border py-1">
                <dt className={`w-16 ${typeClasses.label} leading-5 ${SIDE_TONE[side].text}`}>
                  {en.sides[side]}
                </dt>
                <dd className={account === undefined ? 'text-text-muted' : 'font-semibold'}>
                  {account === undefined ? en.entryForm.chooseAccount : en.accounts[account]}
                </dd>
              </div>
            );
          })}
        </dl>
        <div className={DENSE_FIELD}>
          <label htmlFor={`${id}-amount`}>{en.twoLineForm.amount}</label>
          <AmountInput id={`${id}-amount`} />
        </div>
        {footer}
      </div>
      <AccountPicker id={id} chosen={chosen} onChoose={choose} />
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
