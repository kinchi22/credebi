'use client';

import {
  ENTRY_FORM_FIELDS,
  entryFormModeSchema,
  type AccountId,
  type AccountOutput,
  type ChartOutput,
  type DomainError,
  type Money,
  type PostedEntry,
  type Result,
  type Side,
} from '@repo/contracts';
import { draftTotals, type DraftLine, type DraftTotals } from '@repo/core/entries';
import { isZeroMoney } from '@repo/core/money';
import { CloseIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { AccountPicker, AddAccountButton, useAccountSheet } from './account-picker';
import { formatAmount } from './amount';
import { BARE_ICON_BUTTON } from './control-classes';
import {
  AmountInput,
  ENTRY_FORM_GRID,
  EntryFormShell,
  type EntryFormParts,
  type EntryFormProps,
  type SubmitButton,
} from './entry-form';
import { linesOnDay, offeredOn } from './lines-on-day';
import { SIDE_TONE, SIDES } from './side-classes';
import { DANGER_TEXT } from './text-classes';

type ChosenLine = DraftLine & {
  readonly account: AccountId;
  readonly accountName: string;
};

const isLine =
  (side: Side, account: AccountId) =>
  (line: ChosenLine): boolean =>
    line.side === side && line.account === account;

const lineName = (line: ChosenLine): string => `${en.sides[line.side]} ${line.accountName}`;

const linesOf = (entry: PostedEntry | undefined): readonly ChosenLine[] =>
  (entry?.lines ?? []).map((line) => ({
    side: line.side,
    account: line.account,
    accountName: line.accountName,
    amount: String(line.amount),
  }));

const LINE_GRID = 'grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3';
const AMOUNT_COLUMN = 'flex min-w-0 gap-1';
const REMOVE_COLUMN = 'w-8 shrink-0 wide:w-6';

type SideTotalProps = {
  readonly side: Side;
  readonly amount: Money;
  readonly ruled: boolean;
};

const SIDE_TOTAL: Readonly<Record<Side, { readonly testId: string; readonly label: string }>> = {
  debit: { testId: 'debit-total', label: en.multiLineForm.debitTotal },
  credit: { testId: 'credit-total', label: en.multiLineForm.creditTotal },
};

function SideTotal({ side, amount, ruled }: SideTotalProps): ReactNode {
  return (
    <p
      className={`${LINE_GRID} items-baseline border-t border-dashed border-border pt-1.5 pb-1 ${ruled ? '' : 'wide:border-t-0'} ${typeClasses['body-dense']}`}
    >
      <span className="text-text-muted">{SIDE_TOTAL[side].label}</span>
      <span className={AMOUNT_COLUMN}>
        <span
          data-testid={SIDE_TOTAL[side].testId}
          className={`min-w-0 grow border border-transparent px-2 text-right ${typeClasses.figure}`}
        >
          {formatAmount(amount)}
        </span>
        <span aria-hidden="true" className={REMOVE_COLUMN} />
      </span>
    </p>
  );
}

type DifferenceRowProps = {
  readonly totals: Result<DraftTotals, DomainError>;
  readonly refusal: ReactNode;
  readonly submitButton: ReactNode;
};

function DifferenceRow({ totals, refusal, submitButton }: DifferenceRowProps): ReactNode {
  return (
    <div className="flex flex-col gap-2 border-t-3 border-double border-text pt-2.5">
      <div className="flex items-center gap-3">
        {totals.ok ? (
          <p className="flex min-w-0 grow items-baseline gap-2.5">
            <span className={`${typeClasses.label} text-text-muted`}>
              {en.multiLineForm.difference}
            </span>
            <span
              data-testid="difference"
              className={`${typeClasses.figure} ${isZeroMoney(totals.value.difference) ? 'text-text' : 'font-medium text-warning'}`}
            >
              {formatAmount(totals.value.difference)}
            </span>
          </p>
        ) : (
          <p className={`min-w-0 grow ${DANGER_TEXT} ${typeClasses['body-dense']}`}>
            {en.multiLineForm.tooLarge}
          </p>
        )}
        {submitButton}
      </div>
      {refusal}
    </div>
  );
}

type LineFieldsProps = {
  readonly id: string;
  readonly line: ChosenLine;
  readonly active: boolean;
  readonly onAmountChange: (amount: string) => void;
  readonly onRemove: () => void;
};

function LineFields({ id, line, active, onAmountChange, onRemove }: LineFieldsProps): ReactNode {
  const lineId = `${id}-${line.side}-${line.account}`;

  return (
    <fieldset
      aria-label={`${en.sides[line.side]} ${line.accountName}`}
      className={`${LINE_GRID} items-center py-1 ${typeClasses['body-dense']}`}
    >
      <input type="hidden" name={ENTRY_FORM_FIELDS.account} value={line.account} />
      <input type="hidden" name={ENTRY_FORM_FIELDS.side} value={line.side} />
      <div className="flex min-w-0 flex-col">
        <p aria-hidden className="font-semibold break-words">
          {line.accountName}
        </p>
        {active ? null : <p className="text-warning">{en.multiLineForm.notActive.mark}</p>}
      </div>
      <div className={`${AMOUNT_COLUMN} items-center`}>
        <div className="min-w-0 grow">
          <AmountInput
            id={`${lineId}-amount`}
            label={en.multiLineForm.amount}
            defaultValue={line.amount}
            onAmountChange={onAmountChange}
          />
        </div>
        <button
          type="button"
          aria-label={en.multiLineForm.remove}
          onClick={onRemove}
          className={`${REMOVE_COLUMN} h-7.5 ${BARE_ICON_BUTTON}`}
        >
          <CloseIcon />
        </button>
      </div>
    </fieldset>
  );
}

type MultiLineFieldsProps = EntryFormParts & {
  readonly chart: ChartOutput;
};

type Refused = {
  readonly day: string | undefined;
  readonly side: Side;
  readonly account: AccountId;
};

type NotActiveRefusalProps = {
  readonly editing: boolean;
  readonly line: ChosenLine;
};

function NotActiveRefusal({ editing, line }: NotActiveRefusalProps): ReactNode {
  const { notActive } = en.multiLineForm;
  return (
    <p role="alert" className={`min-w-0 flex-1 text-danger ${typeClasses['body-dense']}`}>
      {editing ? notActive.notSaved : notActive.notAdded} {lineName(line)} {notActive.refusal}
    </p>
  );
}

const heldSubmit = (submitButton: SubmitButton, hold: (() => void) | undefined): ReactNode =>
  submitButton(
    hold === undefined
      ? undefined
      : (event) => {
          event.preventDefault();
          hold();
        },
  );

function MultiLineFields({
  id,
  day,
  chart,
  entry,
  heading,
  refusal,
  submitButton,
}: MultiLineFieldsProps): ReactNode {
  const [picked, setPicked] = useState<readonly ChosenLine[]>(() => linesOf(entry));
  const [refused, setRefused] = useState<Refused>();
  const sheet = useAccountSheet();
  const offered = offeredOn(chart, day);
  const lines = linesOnDay(offered, picked);
  const [heldBy] = lines.notActive;
  const refusedLine =
    refused !== undefined && refused.day === day
      ? lines.notActive.find(isLine(refused.side, refused.account))
      : undefined;

  const remove = (side: Side, account: AccountId): void => {
    setPicked((current) => current.filter((line) => !isLine(side, account)(line)));
  };

  const pick = (side: Side, account: AccountOutput, ticked: boolean): void => {
    if (!ticked) {
      remove(side, account.id);
      return;
    }
    setPicked((current) => [
      ...current,
      { side, account: account.id, accountName: account.name, amount: '' },
    ]);
  };

  const changeAmount = (side: Side, account: AccountId, amount: string): void => {
    setPicked((current) =>
      current.map((line) => (isLine(side, account)(line) ? { ...line, amount } : line)),
    );
  };

  const isChosen = (side: Side, account: AccountId): boolean =>
    picked.some(isLine(side, account));

  const totals = draftTotals(lines.counted);
  const isActive = (line: ChosenLine): boolean => !lines.notActive.includes(line);

  return (
    <div className={ENTRY_FORM_GRID}>
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <div className="flex flex-col">
          {SIDES.map((side) => {
            const sideLines = picked.filter((line) => line.side === side);
            return (
              <div key={side} className={`flex flex-col border-t-2 pt-2 ${SIDE_TONE[side].edge}`}>
                <p aria-hidden className={`${typeClasses.label} pb-1 ${SIDE_TONE[side].text}`}>
                  {en.sides[side]}
                </p>
                <div className="flex flex-col">
                  {sideLines.map((line) => (
                    <LineFields
                      key={`${line.side}-${line.account}`}
                      id={id}
                      line={line}
                      active={isActive(line)}
                      onAmountChange={(amount) => {
                        changeAmount(line.side, line.account, amount);
                      }}
                      onRemove={() => {
                        remove(line.side, line.account);
                      }}
                    />
                  ))}
                </div>
                {offered.ids.size === 0 ? null : <AddAccountButton side={side} sheet={sheet} />}
                {totals.ok ? (
                  <SideTotal side={side} amount={totals.value[side]} ruled={sideLines.length > 0} />
                ) : null}
              </div>
            );
          })}
        </div>
        <DifferenceRow
          totals={totals}
          refusal={
            refusedLine === undefined ? (
              refusal
            ) : (
              <NotActiveRefusal editing={entry !== undefined} line={refusedLine} />
            )
          }
          submitButton={heldSubmit(
            submitButton,
            heldBy === undefined
              ? undefined
              : () => {
                  setRefused({ day, side: heldBy.side, account: heldBy.account });
                },
          )}
        />
      </div>
      <AccountPicker
        id={id}
        chart={offered.chart}
        multiple
        isChosen={isChosen}
        onPick={pick}
        sheet={sheet}
      />
    </div>
  );
}

export function MultiLineEntryForm({ action, chart, editing }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell
      action={action}
      editing={editing}
      mode={entryFormModeSchema.enum['multi-line']}
    >
      {(parts) => <MultiLineFields {...parts} chart={chart} />}
    </EntryFormShell>
  );
}
