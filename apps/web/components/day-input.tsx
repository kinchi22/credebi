'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { DAY_DIGITS, digitsOfIsoDay, isoOfDayDigits } from './day-digits';
import { DayPicker } from './day-picker';
import { DigitField, type DigitUnit } from './digit-field';
import { useBrowserToday } from './use-browser-today';

export type DayInputProps = {
  readonly id?: string;
  readonly name: string;
  readonly day: string;
  readonly onDay?: (day: string) => void;
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly withPicker?: boolean;
  readonly className: string;
};

const DAY_PANEL = 'w-72';

const DAY_UNIT: DigitUnit = {
  limit: DAY_DIGITS,
  rules: [4, 6],
  placeholder: 'YYYYMMDD',
  isoOf: isoOfDayDigits,
  digitsOf: digitsOfIsoDay,
};

export function DayInput({
  id,
  name,
  day,
  onDay,
  required,
  autoComplete,
  withPicker,
  className,
}: DayInputProps): ReactNode {
  const t = useTranslations('dayInput');
  const today = useBrowserToday();

  return (
    <DigitField
      unit={DAY_UNIT}
      id={id}
      name={name}
      value={day}
      onValue={onDay}
      required={required}
      autoComplete={autoComplete}
      withPicker={withPicker}
      className={className}
      invalid={t('invalid')}
      buttonLabel={t('chooseDate')}
      popoverLabel={t('calendar')}
      closeLabel={t('close')}
      panelClassName={DAY_PANEL}
      fallbackStart={today}
      picker={(start, chosen, pick) => <DayPicker start={start} chosen={chosen} today={today} onPick={pick} />}
    />
  );
}
