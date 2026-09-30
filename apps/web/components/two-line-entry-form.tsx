'use client';

import { ENTRY_FORM_FIELDS, entryFormModeSchema } from '@repo/contracts';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountSelect,
  AmountInput,
  EntryFormShell,
  type EntryFormProps,
} from './entry-form';
import { FIELD } from './control-classes';

export function TwoLineEntryForm({ action }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} mode={entryFormModeSchema.enum['two-line']}>
      {(id) => (
        <div className="flex flex-wrap items-end gap-3">
          <div className={FIELD}>
            <label htmlFor={`${id}-debit-account`}>{en.twoLineForm.debitAccount}</label>
            <AccountSelect id={`${id}-debit-account`} name={ENTRY_FORM_FIELDS.debitAccount} />
          </div>
          <div className={FIELD}>
            <label htmlFor={`${id}-credit-account`}>{en.twoLineForm.creditAccount}</label>
            <AccountSelect id={`${id}-credit-account`} name={ENTRY_FORM_FIELDS.creditAccount} />
          </div>
          <div className={FIELD}>
            <label htmlFor={`${id}-amount`}>{en.twoLineForm.amount}</label>
            <AmountInput id={`${id}-amount`} />
          </div>
        </div>
      )}
    </EntryFormShell>
  );
}
