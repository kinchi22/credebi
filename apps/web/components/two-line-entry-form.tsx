'use client';

import { entryFormModeSchema, sideSchema, type Side } from '@repo/contracts';
import { type AccountCode } from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountPicker,
  AccountRow,
  ChooseAccountButton,
  useAccountSheet,
  type AccountChoice,
} from './account-picker';
import {
  AmountInput,
  ENTRY_FORM_GRID,
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
    <div className={ENTRY_FORM_GRID}>
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <div className={`flex flex-col ${typeClasses['body-dense']}`}>
          {sideSchema.options.map((side) => (
            <div key={side}>
              <ChooseAccountButton side={side} account={chosen[side]} sheet={sheet} />
              <AccountRow side={side} account={chosen[side]} />
            </div>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <div className="min-w-0 grow">
            <AmountInput id={`${id}-amount`} label={en.twoLineForm.amount} />
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
