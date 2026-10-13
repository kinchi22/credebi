'use client';

import Link from 'next/link';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { en } from '../messages/en';
import { SETTINGS_PATH } from '../server/return-path';
import { WarningWithHelpTip } from './help-tip';
import { isLine, lineHoldingSubmit, type AccountLine, type LinesOnDay } from './lines-on-day';
import { LINK } from './text-classes';

const { notActiveOnDay } = en;

type NotActiveMarkProps = {
  readonly accountName: string;
  readonly explanation: string;
};

export function NotActiveMark({ accountName, explanation }: NotActiveMarkProps): ReactNode {
  return (
    <WarningWithHelpTip message={notActiveOnDay.mark}>
      {accountName} {explanation}{' '}
      <Link href={SETTINGS_PATH} className={LINK}>
        {notActiveOnDay.settings}
      </Link>
      .
    </WarningWithHelpTip>
  );
}

type Raised = AccountLine & {
  readonly day: string | undefined;
};

export type NotActiveHold<Line extends AccountLine> = {
  readonly refused: Line | undefined;
  readonly holdSubmit: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  readonly clear: () => void;
};

export function useNotActiveHold<Line extends AccountLine>(
  day: string | undefined,
  lines: LinesOnDay<Line>,
): NotActiveHold<Line> {
  const [raised, setRaised] = useState<Raised>();
  if (raised !== undefined && raised.day !== day) {
    setRaised(undefined);
  }
  const holding = lineHoldingSubmit(lines);

  return {
    refused:
      raised === undefined ? undefined : lines.notActive.find(isLine(raised.side, raised.account)),
    holdSubmit:
      holding === undefined
        ? undefined
        : (event) => {
            event.preventDefault();
            setRaised({ day, side: holding.side, account: holding.account });
          },
    clear: () => {
      setRaised(undefined);
    },
  };
}
