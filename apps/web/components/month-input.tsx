'use client';

import { useTranslations } from 'next-intl';
import { monthAfter } from '@repo/core/entries';
import type { ReactNode } from 'react';
import { MONTH_DIGITS, digitsOfIsoMonth, isoOfMonthDigits } from './day-digits';
import { DigitField, type DigitUnit } from './digit-field';
import { MonthGrid } from './month-grid';

export type MonthInputProps = {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly onMonth: (month: string) => void;
  readonly today: string | undefined;
  readonly className: string;
};

const MONTH_PANEL = 'w-64';

const MONTH_UNIT: DigitUnit = {
  limit: MONTH_DIGITS,
  rules: [4],
  placeholder: 'YYYYMM',
  isoOf: isoOfMonthDigits,
  digitsOf: digitsOfIsoMonth,
};

export function MonthInput({ id, name, month, onMonth, today, className }: MonthInputProps): ReactNode {
  const t = useTranslations('monthInput');
  const thisMonth = today === undefined ? undefined : monthAfter(today, 0);

  return (
    <DigitField
      unit={MONTH_UNIT}
      id={id}
      name={name}
      value={month}
      onValue={onMonth}
      required
      className={className}
      invalid={t('invalid')}
      buttonLabel={t('chooseMonth')}
      popoverLabel={t('chooseMonth')}
      closeLabel={t('close')}
      panelClassName={MONTH_PANEL}
      fallbackStart={thisMonth}
      picker={(start, chosen, pick) => <MonthGrid start={start} chosen={chosen} today={thisMonth} onPick={pick} />}
    />
  );
}
