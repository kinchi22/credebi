'use client';

import {
  accountsIn,
  entryFormModeSchema,
  sideSchema,
  type AccountId,
  type AccountOutput,
  type ChartOutput,
  type OfferedTitle,
  type PostedEntry,
  type Side,
} from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { SETTINGS_PATH } from '../server/return-path';
import {
  AccountPicker,
  AccountRow,
  ChooseAccountButton,
  UnderAccountName,
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
import { WarningWithHelpTip } from './help-tip';
import { isLine, lineName, linesOnDay, offeredOn, type NamedLine } from './lines-on-day';
import { NotActiveMark, useNotActiveHold } from './not-active-on-day';
import { FORM_REFUSAL, LINK } from './text-classes';
import { suggestedOn } from './suggested-accounts';
import { prefillFrom, type PrefilledLine } from './title-prefill';

const { helpTip, needsMultiLineMode, notActiveOnDay } = en;
const notActive = notActiveOnDay.twoLine;

const NOTHING_CHOSEN: AccountChoice = { debit: undefined, credit: undefined };

const accountById = (chart: ChartOutput, id: AccountId | undefined): AccountOutput | undefined =>
  accountsIn(chart).find((account) => account.id === id);

const prefilledChoice = (chart: ChartOutput, lines: readonly PrefilledLine[]): AccountChoice => ({
  debit: accountById(chart, lines.find((line) => line.side === 'debit')?.account),
  credit: accountById(chart, lines.find((line) => line.side === 'credit')?.account),
});

type NeedsMultiLineMarkProps = {
  readonly title: string;
};

function NeedsMultiLineMark({ title }: NeedsMultiLineMarkProps): ReactNode {
  return (
    <WarningWithHelpTip message={needsMultiLineMode.mark}>
      {needsMultiLineMode.lastEntry} {title} {needsMultiLineMode.explanation}{' '}
      <Link href={SETTINGS_PATH} className={LINK}>
        {helpTip.settings}
      </Link>{' '}
      {needsMultiLineMode.afterSettings}
    </WarningWithHelpTip>
  );
}

const accountOn = (
  chart: ChartOutput,
  entry: PostedEntry,
  side: Side,
): AccountOutput | undefined => accountById(chart, linesOn(entry, side)[0]?.account);

const namedLines = (choice: AccountChoice): readonly NamedLine[] =>
  sideSchema.options.flatMap((side) => {
    const account = choice[side];
    return account === undefined
      ? []
      : [{ side, account: account.id, accountName: account.name }];
  });

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
  matchedTitle,
  heading,
  refusal,
  submitButton,
}: TwoLineFieldsProps): ReactNode {
  const [picked, setPicked] = useState<AccountChoice>(() => choiceOf(chart, entry));
  const [amount, setAmount] = useState(entry === undefined ? '' : String(entry.total));
  const [needsMultiLine, setNeedsMultiLine] = useState<string>();
  const sheet = useAccountSheet();
  const offered = offeredOn(chart, day);
  const named = namedLines(picked);
  const lines = linesOnDay(offered, named);
  const hold = useNotActiveHold(day, lines);

  const choose = (side: Side, account: AccountOutput): void => {
    hold.clear();
    setPicked((current) => ({ ...current, [side]: account }));
  };

  const isChosen = (side: Side, account: AccountId): boolean => picked[side]?.id === account;

  const chooseTitle = ({ title, lines: source }: OfferedTitle): void => {
    const prefill = prefillFrom(
      { mode: 'two-line', debit: picked.debit?.id, credit: picked.credit?.id, amount },
      source,
      chart,
    );
    setNeedsMultiLine(prefill.outcome === 'needs-multi-line' ? title : undefined);
    if (prefill.outcome === 'filled') {
      hold.clear();
      setPicked(prefilledChoice(chart, prefill.lines));
      setAmount(prefill.lines[0]?.amount ?? '');
    }
  };

  return (
    <div className={ENTRY_FORM_GRID}>
      <div className="flex min-w-0 flex-col gap-3">
        {heading({
          onChoose: chooseTitle,
          onType: () => {
            setNeedsMultiLine(undefined);
          },
          notice:
            needsMultiLine === undefined ? null : <NeedsMultiLineMark title={needsMultiLine} />,
        })}
        <div className={`flex flex-col ${typeClasses['body-dense']}`}>
          {sideSchema.options.map((side) => {
            const line = named.find((chosen) => chosen.side === side);
            return (
              <div
                key={side}
                role={line === undefined ? undefined : 'group'}
                aria-label={line === undefined ? undefined : lineName(line)}
              >
                {offered.ids.size === 0 ? null : (
                  <ChooseAccountButton side={side} account={picked[side]} sheet={sheet} />
                )}
                <AccountRow side={side} account={picked[side]} />
                {line !== undefined && lines.notActive.some(isLine(line.side, line.account)) ? (
                  <UnderAccountName>
                    <NotActiveMark
                      accountName={line.accountName}
                      explanation={notActive.explanation}
                    />
                  </UnderAccountName>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-3">
          <div className="min-w-0 grow">
            <AmountInput
              id={`${id}-amount`}
              label={en.twoLineForm.amount}
              value={amount}
              onAmountChange={setAmount}
            />
          </div>
          {submitButton(hold.holdSubmit)}
        </div>
        {hold.refused === undefined ? (
          refusal
        ) : (
          <p role="alert" className={FORM_REFUSAL}>
            {entry === undefined ? notActiveOnDay.notAdded : notActiveOnDay.notSaved}{' '}
            {hold.refused.accountName} {notActive.refusal}
          </p>
        )}
      </div>
      <AccountPicker
        id={id}
        chart={offered.chart}
        isChosen={isChosen}
        onPick={choose}
        suggested={suggestedOn(matchedTitle, offered)}
        sheet={sheet}
      />
    </div>
  );
}

export function TwoLineEntryForm({ action, chart, titles, editing }: EntryFormProps): ReactNode {
  return (
    <EntryFormShell
      action={action}
      titles={titles}
      editing={editing}
      mode={entryFormModeSchema.enum['two-line']}
    >
      {(parts) => <TwoLineFields {...parts} chart={chart} />}
    </EntryFormShell>
  );
}
