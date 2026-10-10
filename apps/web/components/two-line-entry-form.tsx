'use client';

import {
  accountsIn,
  entryFormModeSchema,
  sideSchema,
  type AccountId,
  type AccountOutput,
  type ChartOutput,
  type PostedEntry,
  type Side,
} from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountPicker,
  AccountRow,
  ChooseAccountButton,
  OutsideActivePeriod,
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
import { offeredOn } from './lines-on-day';

const NOTHING_CHOSEN: AccountChoice = { debit: undefined, credit: undefined };

const accountOn = (
  chart: ChartOutput,
  entry: PostedEntry,
  side: Side,
): AccountOutput | undefined => {
  const line = linesOn(entry, side)[0];
  return accountsIn(chart).find((account) => account.id === line?.account);
};

const choiceOf = (chart: ChartOutput, entry: PostedEntry | undefined): AccountChoice =>
  entry === undefined
    ? NOTHING_CHOSEN
    : { debit: accountOn(chart, entry, 'debit'), credit: accountOn(chart, entry, 'credit') };

type TwoLineFieldsProps = EntryFormParts & {
  readonly chart: ChartOutput;
};

function TwoLineFields({
  id,
  day,
  chart,
  entry,
  heading,
  refusal,
  submitButton,
}: TwoLineFieldsProps): ReactNode {
  const [picked, setPicked] = useState<AccountChoice>(() => choiceOf(chart, entry));
  const sheet = useAccountSheet();
  const offered = offeredOn(chart, day);
  const offeredAccount = (account: AccountOutput | undefined): AccountOutput | undefined =>
    account !== undefined && offered.ids.has(account.id) ? account : undefined;
  const chosen: AccountChoice = {
    debit: offeredAccount(picked.debit),
    credit: offeredAccount(picked.credit),
  };

  const choose = (side: Side, account: AccountOutput): void => {
    setPicked((current) => ({ ...current, [side]: account }));
  };

  const isChosen = (side: Side, account: AccountId): boolean => chosen[side]?.id === account;

  return (
    <div className={ENTRY_FORM_GRID}>
      <div className="flex min-w-0 flex-col gap-3">
        {heading}
        <div className={`flex flex-col ${typeClasses['body-dense']}`}>
          {sideSchema.options.map((side) => (
            <div key={side}>
              {offered.ids.size === 0 ? null : (
                <ChooseAccountButton side={side} account={chosen[side]} sheet={sheet} />
              )}
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
          {submitButton()}
        </div>
        <OutsideActivePeriod entry={entry} offered={offered} />
        {refusal}
      </div>
      <AccountPicker id={id} chart={offered.chart} isChosen={isChosen} onPick={choose} sheet={sheet} />
    </div>
  );
}

export function TwoLineEntryForm({ action, chart, editing }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell action={action} editing={editing} mode={entryFormModeSchema.enum['two-line']}>
      {(parts) => <TwoLineFields {...parts} chart={chart} />}
    </EntryFormShell>
  );
}
