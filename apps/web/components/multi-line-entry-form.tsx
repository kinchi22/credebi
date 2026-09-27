'use client';

import { ENTRY_FORM_FIELDS, entryFormModeSchema, sideSchema, type Side } from '@repo/contracts';
import { draftTotals, type DraftLine } from '@repo/core/entries';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountSelect,
  AmountInput,
  CONTROL,
  EntryFormShell,
  FIELD,
  type EntryFormProps,
} from './entry-form';
import { formatAmount } from './amount';

type LineState = DraftLine & {
  readonly key: number;
};

const SIDES: readonly Side[] = sideSchema.options;

const MINIMUM_LINES = 2;

const FIRST_LINES: readonly LineState[] = [
  { key: 1, side: 'debit', amount: '' },
  { key: 2, side: 'credit', amount: '' },
];

const BUTTON = 'rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50';

function DraftTotalsSummary({ lines }: { readonly lines: readonly DraftLine[] }): ReactNode {
  const totals = draftTotals(lines);
  if (!totals.ok) {
    return <p className="text-sm text-red-700">{en.multiLineForm.tooLarge}</p>;
  }

  const rows = [
    { testId: 'debit-total', label: en.multiLineForm.debitTotal, amount: totals.value.debit },
    { testId: 'credit-total', label: en.multiLineForm.creditTotal, amount: totals.value.credit },
    { testId: 'difference', label: en.multiLineForm.difference, amount: totals.value.difference },
  ];

  return (
    <dl className="grid grid-cols-[auto_8rem] gap-x-3 text-sm">
      {rows.map((row) => (
        <div key={row.testId} className="contents">
          <dt>{row.label}</dt>
          <dd data-testid={row.testId} className="text-right tabular-nums">
            {formatAmount(row.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DraftLines({ id }: { readonly id: string }): ReactNode {
  const [lines, setLines] = useState<readonly LineState[]>(FIRST_LINES);

  const change = (key: number, update: Partial<DraftLine>): void => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...update } : line)));
  };

  const add = (): void => {
    setLines((current) => [
      ...current,
      { key: Math.max(...current.map((line) => line.key)) + 1, side: 'debit', amount: '' },
    ]);
  };

  const remove = (key: number): void => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const removable = lines.length > MINIMUM_LINES;

  return (
    <>
      {lines.map((line, index) => {
        const lineId = `${id}-line-${String(line.key)}`;
        return (
          <fieldset key={line.key} className="flex flex-wrap items-end gap-3">
            <legend className="mb-1 text-sm font-medium">
              {en.multiLineForm.line} {index + 1}
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
                onChange={(event) => {
                  const side = sideSchema.safeParse(event.target.value);
                  if (side.success) {
                    change(line.key, { side: side.data });
                  }
                }}
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
              <AmountInput
                id={`${lineId}-amount`}
                onAmountChange={(amount) => {
                  change(line.key, { amount });
                }}
              />
            </div>
            <button
              type="button"
              disabled={!removable}
              onClick={() => {
                remove(line.key);
              }}
              className={BUTTON}
            >
              {en.multiLineForm.removeLine}
            </button>
          </fieldset>
        );
      })}

      <button type="button" onClick={add} className={`${BUTTON} self-start`}>
        {en.multiLineForm.addLine}
      </button>

      <DraftTotalsSummary lines={lines} />
    </>
  );
}

export function MultiLineEntryForm({ action }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} mode={entryFormModeSchema.enum['multi-line']}>
      {(id) => <DraftLines id={id} />}
    </EntryFormShell>
  );
}
