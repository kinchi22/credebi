'use client';

import { ENTRY_FORM_FIELDS, entryFormModeSchema, type Side } from '@repo/contracts';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountSelect,
  AmountInput,
  CONTROL,
  EntryFormShell,
  FIELD,
  type EntryFormProps,
} from './entry-form';

const LINES: readonly { readonly number: number; readonly side: Side }[] = [
  { number: 1, side: 'debit' },
  { number: 2, side: 'credit' },
];

const SIDES: readonly Side[] = ['debit', 'credit'];

export function MultiLineEntryForm({ action }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell
      action={action}
      mode={entryFormModeSchema.enum['multi-line']}
      invalid={en.multiLineForm.invalid}
    >
      {(id) =>
        LINES.map((line) => {
          const lineId = `${id}-line-${String(line.number)}`;
          return (
            <fieldset key={line.number} className="flex flex-wrap items-end gap-3">
              <legend className="mb-1 text-sm font-medium">
                {en.multiLineForm.line} {line.number}
              </legend>
              <div className={FIELD}>
                <label htmlFor={`${lineId}-account`}>{en.multiLineForm.account}</label>
                <AccountSelect id={`${lineId}-account`} name={ENTRY_FORM_FIELDS.account} />
              </div>
              <div className={FIELD}>
                <label htmlFor={`${lineId}-side`}>{en.multiLineForm.side}</label>
                <select
                  id={`${lineId}-side`}
                  name={ENTRY_FORM_FIELDS.side}
                  required
                  defaultValue={line.side}
                  className={CONTROL}
                >
                  {SIDES.map((side) => (
                    <option key={side} value={side}>
                      {en.sides[side]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={FIELD}>
                <label htmlFor={`${lineId}-amount`}>{en.multiLineForm.amount}</label>
                <AmountInput id={`${lineId}-amount`} />
              </div>
            </fieldset>
          );
        })
      }
    </EntryFormShell>
  );
}
