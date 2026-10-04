'use client';

import { entryFormModeSchema, sideSchema, type PostedEntry, type Side } from '@repo/contracts';
import { isAccountCode, type AccountCode } from '@repo/core/entries';
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
import { linesOn } from './entry-lines';

const NOTHING_CHOSEN: AccountChoice = { debit: undefined, credit: undefined };

const accountOn = (entry: PostedEntry, side: Side): AccountCode | undefined => {
  const account = linesOn(entry, side)[0]?.account;
  return account !== undefined && isAccountCode(account) ? account : undefined;
};

const choiceOf = (entry: PostedEntry | undefined): AccountChoice =>
  entry === undefined
    ? NOTHING_CHOSEN
    : { debit: accountOn(entry, 'debit'), credit: accountOn(entry, 'credit') };

function TwoLineFields({ id, entry, heading, refusal, submitButton }: EntryFormParts): ReactNode {
  const [chosen, setChosen] = useState<AccountChoice>(() => choiceOf(entry));
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
            <AmountInput
              id={`${id}-amount`}
              label={en.twoLineForm.amount}
              defaultValue={entry === undefined ? undefined : String(entry.total)}
            />
          </div>
          {submitButton}
        </div>
        {refusal}
      </div>
      <AccountPicker id={id} isChosen={isChosen} onPick={choose} sheet={sheet} />
    </div>
  );
}

export function TwoLineEntryForm({ action, editing }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} editing={editing} mode={entryFormModeSchema.enum['two-line']}>
      {(parts) => <TwoLineFields {...parts} />}
    </EntryFormShell>
  );
}
