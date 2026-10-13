'use client';

import { type AccountId, type Side } from '@repo/contracts';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { SETTINGS_PATH } from '../server/return-path';
import { type SubmitButton } from './entry-form';
import { HELP_TIP_ROW, HelpTip } from './help-tip';
import { lineHoldingSubmit, type LinesOnDay } from './lines-on-day';
import { FORM_REFUSAL, LINK } from './text-classes';

export type NamedLine = {
  readonly side: Side;
  readonly account: AccountId;
  readonly accountName: string;
};

export const lineName = (line: NamedLine): string => `${en.sides[line.side]} ${line.accountName}`;

const { notActiveOnDay } = en;

type NotActiveMarkProps = {
  readonly accountName: string;
};

export function NotActiveMark({ accountName }: NotActiveMarkProps): ReactNode {
  return (
    <div className={`${HELP_TIP_ROW} text-warning`}>
      <span>{notActiveOnDay.mark}</span>
      <HelpTip message={notActiveOnDay.mark}>
        {accountName} {notActiveOnDay.explanation}{' '}
        <Link href={SETTINGS_PATH} className={LINK}>
          {notActiveOnDay.settings}
        </Link>
        .
      </HelpTip>
    </div>
  );
}

type NotActiveRefusalProps = {
  readonly editing: boolean;
  readonly line: NamedLine;
};

function NotActiveRefusal({ editing, line }: NotActiveRefusalProps): ReactNode {
  return (
    <p role="alert" className={FORM_REFUSAL}>
      {editing ? notActiveOnDay.notSaved : notActiveOnDay.notAdded} {lineName(line)}{' '}
      {notActiveOnDay.refusal}
    </p>
  );
}

type Raised = {
  readonly day: string | undefined;
  readonly side: Side;
  readonly account: AccountId;
};

export const isLine =
  (side: Side, account: AccountId) =>
  (line: NamedLine): boolean =>
    line.side === side && line.account === account;

export type NotActiveHold = {
  readonly refusal: ReactNode;
  readonly submitButton: ReactNode;
  readonly clear: () => void;
};

type NotActiveHoldOptions<Line extends NamedLine> = {
  readonly day: string | undefined;
  readonly lines: LinesOnDay<Line>;
  readonly editing: boolean;
  readonly refusal: ReactNode;
  readonly submitButton: SubmitButton;
};

export function useNotActiveHold<Line extends NamedLine>({
  day,
  lines,
  editing,
  refusal,
  submitButton,
}: NotActiveHoldOptions<Line>): NotActiveHold {
  const [raised, setRaised] = useState<Raised>();
  if (raised !== undefined && raised.day !== day) {
    setRaised(undefined);
  }
  const holding = lineHoldingSubmit(lines);
  const refused =
    raised === undefined ? undefined : lines.notActive.find(isLine(raised.side, raised.account));

  return {
    refusal: refused === undefined ? refusal : <NotActiveRefusal editing={editing} line={refused} />,
    submitButton: submitButton(
      holding === undefined
        ? undefined
        : (event) => {
            event.preventDefault();
            setRaised({ day, side: holding.side, account: holding.account });
          },
    ),
    clear: () => {
      setRaised(undefined);
    },
  };
}
