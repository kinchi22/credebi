'use client';

import { useTranslations } from 'next-intl';
import { monthRangeOf, type DayRange, type MonthRange } from '@repo/core/entries';
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { DATE_CONTROL, FIELD } from './control-classes';
import { DatePresets, DatePresetsSheet, type Granularity } from './date-presets';

export type RangeFieldNames = {
  readonly from: string;
  readonly to: string;
};

export type RangeFieldsProps = {
  readonly granularity: Granularity;
  readonly names: RangeFieldNames;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly today: string | undefined;
  readonly children?: ReactNode;
};

type Unit = {
  readonly input: 'date' | 'month';
  readonly labels: 'dayRange' | 'monthRange';
  readonly valuesOf: (range: DayRange) => DayRange | MonthRange;
};

const UNITS: Readonly<Record<Granularity, Unit>> = {
  day: { input: 'date', labels: 'dayRange', valuesOf: (range) => range },
  month: { input: 'month', labels: 'monthRange', valuesOf: monthRangeOf },
};

const RANGE_FIELD = `${DATE_CONTROL} w-full min-w-0 wide:w-auto`;

function keepingAValue(set: (value: string) => void): (event: ChangeEvent<HTMLInputElement>) => void {
  return (event) => {
    if (event.target.value !== '') {
      set(event.target.value);
    }
  };
}

export function RangeFields({
  granularity,
  names,
  from: initialFrom,
  to: initialTo,
  today,
  children,
}: RangeFieldsProps): ReactNode {
  const unit = UNITS[granularity];
  const t = useTranslations(unit.labels);
  const id = useId();
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const fromInput = useRef<HTMLInputElement>(null);

  const submitPreset = (range: DayRange): void => {
    const values = unit.valuesOf(range);
    flushSync(() => {
      setFrom(values.from);
      setTo(values.to);
    });
    fromInput.current?.form?.requestSubmit();
  };

  return (
    <>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 wide:contents">
        <div className={FIELD}>
          <label htmlFor={`${id}-from`}>{t('from')}</label>
          <input
            ref={fromInput}
            id={`${id}-from`}
            name={names.from}
            type={unit.input}
            value={from}
            onChange={keepingAValue(setFrom)}
            required
            autoComplete="off"
            className={RANGE_FIELD}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${id}-to`}>{t('to')}</label>
          <input
            id={`${id}-to`}
            name={names.to}
            type={unit.input}
            value={to}
            onChange={keepingAValue(setTo)}
            required
            autoComplete="off"
            className={RANGE_FIELD}
          />
        </div>
        <DatePresetsSheet granularity={granularity} today={today} onChoose={submitPreset} />
      </div>

      {children}

      <DatePresets granularity={granularity} today={today} onChoose={submitPreset} />
    </>
  );
}
