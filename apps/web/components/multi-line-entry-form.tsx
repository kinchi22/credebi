'use client';

import { ENTRY_FORM_FIELDS, entryFormModeSchema, type Side } from '@repo/contracts';
import {
  draftLinesInOrder,
  draftTotals,
  type AccountCode,
  type DraftLine,
} from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { Fragment, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { AccountPicker, AddAccountButton, useAccountSheet } from './account-picker';
import { formatAmount } from './amount';
import { BUTTON, DENSE_FIELD } from './control-classes';
import {
  AmountInput,
  EntryFormShell,
  type EntryFormParts,
  type EntryFormProps,
} from './entry-form';
import { SIDE_TONE, SIDES } from './side-classes';
import { DANGER_TEXT } from './text-classes';

type ChosenLine = DraftLine & {
  readonly account: AccountCode;
};

const isLine =
  (side: Side, account: AccountCode) =>
  (line: ChosenLine): boolean =>
    line.side === side && line.account === account;

function DraftTotalsSummary({ lines }: { readonly lines: readonly DraftLine[] }): ReactNode {
  const totals = draftTotals(lines);
  if (!totals.ok) {
    return (
      <p className={`${DANGER_TEXT} ${typeClasses['body-dense']}`}>{en.multiLineForm.tooLarge}</p>
    );
  }

  const rows = [
    { testId: 'debit-total', label: en.multiLineForm.debitTotal, amount: totals.value.debit },
    { testId: 'credit-total', label: en.multiLineForm.creditTotal, amount: totals.value.credit },
    { testId: 'difference', label: en.multiLineForm.difference, amount: totals.value.difference },
  ];

  return (
    <dl className={`grid grid-cols-[auto_8rem] gap-x-3 ${typeClasses['body-dense']}`}>
      {rows.map((row) => (
        <div key={row.testId} className="contents">
          <dt>{row.label}</dt>
          <dd data-testid={row.testId} className={`text-right ${typeClasses.figure}`}>
            {formatAmount(row.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type LineFieldsProps = {
  readonly id: string;
  readonly line: ChosenLine;
  readonly onAmountChange: (amount: string) => void;
  readonly onRemove: () => void;
};

function LineFields({ id, line, onAmountChange, onRemove }: LineFieldsProps): ReactNode {
  const lineId = `${id}-${line.side}-${line.account}`;

  return (
    <fieldset
      aria-label={`${en.sides[line.side]} ${en.accounts[line.account]}`}
      className={`flex flex-wrap items-end gap-3 border-b border-border py-1 ${typeClasses['body-dense']}`}
    >
      <input type="hidden" name={ENTRY_FORM_FIELDS.account} value={line.account} />
      <input type="hidden" name={ENTRY_FORM_FIELDS.side} value={line.side} />
      <p aria-hidden className="flex grow gap-3 self-center">
        <span className={`w-16 ${typeClasses.label} leading-5 ${SIDE_TONE[line.side].text}`}>
          {en.sides[line.side]}
        </span>
        <span className="font-semibold">{en.accounts[line.account]}</span>
      </p>
      <div className={DENSE_FIELD}>
        <label htmlFor={`${lineId}-amount`}>{en.multiLineForm.amount}</label>
        <AmountInput id={`${lineId}-amount`} onAmountChange={onAmountChange} />
      </div>
      <button type="button" onClick={onRemove} className={BUTTON}>
        {en.multiLineForm.remove}
      </button>
    </fieldset>
  );
}

function MultiLineFields({ id, heading, refusal, submitButton }: EntryFormParts): ReactNode {
  const [chosen, setChosen] = useState<readonly ChosenLine[]>([]);
  const sheet = useAccountSheet();

  const pick = (side: Side, account: AccountCode, ticked: boolean): void => {
    setChosen((current) =>
      ticked
        ? [...current, { side, account, amount: '' }]
        : current.filter((line) => !isLine(side, account)(line)),
    );
  };

  const changeAmount = (side: Side, account: AccountCode, amount: string): void => {
    setChosen((current) =>
      current.map((line) => (isLine(side, account)(line) ? { ...line, amount } : line)),
    );
  };

  const isChosen = (side: Side, account: AccountCode): boolean =>
    chosen.some(isLine(side, account));

  return (
    <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <div className="flex flex-col">
          {SIDES.map((side) => (
            <Fragment key={side}>
              {draftLinesInOrder(chosen)
                .filter((line) => line.side === side)
                .map((line) => (
                  <LineFields
                    key={`${line.side}-${line.account}`}
                    id={id}
                    line={line}
                    onAmountChange={(amount) => {
                      changeAmount(line.side, line.account, amount);
                    }}
                    onRemove={() => {
                      pick(line.side, line.account, false);
                    }}
                  />
                ))}
              <AddAccountButton side={side} sheet={sheet} />
            </Fragment>
          ))}
        </div>
        <DraftTotalsSummary lines={chosen} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {refusal}
          {submitButton}
        </div>
      </div>
      <AccountPicker id={id} multiple isChosen={isChosen} onPick={pick} sheet={sheet} />
    </div>
  );
}

export function MultiLineEntryForm({ action }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} mode={entryFormModeSchema.enum['multi-line']}>
      {(parts) => <MultiLineFields {...parts} />}
    </EntryFormShell>
  );
}
