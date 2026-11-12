'use client';

import { useTranslations } from 'next-intl';
import { monthRangeOf, type DayRange } from '@repo/core/entries';
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { DATE_CONTROL, FIELD } from './control-classes';
import { DatePresets, DatePresetsSheet, type Granularity } from './date-presets';
import { MonthInput } from './month-input';
import { monthText, shownMonth } from './month-text';

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
  readonly labels: 'dayRange' | 'monthRange';
  readonly shown: (value: string) => string;
  readonly shownRange: (range: DayRange) => DayRange;
};

const UNITS: Readonly<Record<Granularity, Unit>> = {
  day: { labels: 'dayRange', shown: (value) => value, shownRange: (range) => range },
  month: {
    labels: 'monthRange',
    shown: shownMonth,
    shownRange: (range) => {
      const months = monthRangeOf(range);
      return { from: monthText(months.from), to: monthText(months.to) };
    },
  },
};

const RANGE_FIELD = `${DATE_CONTROL} w-full min-w-0 wide:w-auto`;

function keepingAValue(set: (value: string) => void): (event: ChangeEvent<HTMLInputElement>) => void {
  return (event) => {
    if (event.target.value !== '') {
      set(event.target.value);
    }
  };
}

type RangeFieldProps = {
  readonly granularity: Granularity;
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly today: string | undefined;
};

function RangeField({ granularity, id, name, value, onValue, today }: RangeFieldProps): ReactNode {
  return granularity === 'month' ? (
    <MonthInput id={id} name={name} text={value} onText={onValue} today={today} />
  ) : (
    <input
      id={id}
      name={name}
      type="date"
      value={value}
      onChange={keepingAValue(onValue)}
      required
      autoComplete="off"
      className={RANGE_FIELD}
    />
  );
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
  const [from, setFrom] = useState(unit.shown(initialFrom ?? ''));
  const [to, setTo] = useState(unit.shown(initialTo ?? ''));
  const fields = useRef<HTMLDivElement>(null);

  const submitPreset = (range: DayRange): void => {
    const shown = unit.shownRange(range);
    flushSync(() => {
      setFrom(shown.from);
      setTo(shown.to);
    });
    fields.current?.closest('form')?.requestSubmit();
  };

  return (
    <>
      <div
        ref={fields}
        className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 wide:contents"
      >
        <div className={FIELD}>
          <label htmlFor={`${id}-from`}>{t('from')}</label>
          <RangeField
            granularity={granularity}
            id={`${id}-from`}
            name={names.from}
            value={from}
            onValue={setFrom}
            today={today}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${id}-to`}>{t('to')}</label>
          <RangeField
            granularity={granularity}
            id={`${id}-to`}
            name={names.to}
            value={to}
            onValue={setTo}
            today={today}
          />
        </div>
        <DatePresetsSheet granularity={granularity} today={today} onChoose={submitPreset} />
      </div>

      {children}

      <DatePresets granularity={granularity} today={today} onChoose={submitPreset} />
    </>
  );
}
