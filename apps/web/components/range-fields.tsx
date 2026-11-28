'use client';

import { useTranslations } from 'next-intl';
import { monthRangeOf, type DayRange } from '@repo/core/entries';
import { useId, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { DATE_CONTROL, FIELD } from './control-classes';
import { DatePresets, DatePresetsSheet, type Granularity } from './date-presets';
import { MonthInput } from './month-input';
import { DayInput } from './day-input';

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

type RangeFieldProps = {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly today: string | undefined;
};

const RANGE_ROOT = 'wide:w-fit';

function DayField({ id, name, value, onValue }: RangeFieldProps): ReactNode {
  return (
    <DayInput
      id={id}
      name={name}
      day={value}
      onDay={onValue}
      required
      autoComplete="off"
      className={DATE_CONTROL}
      rootClassName={RANGE_ROOT}
    />
  );
}

function MonthField({ id, name, value, onValue, today }: RangeFieldProps): ReactNode {
  return <MonthInput id={id} name={name} month={value} onMonth={onValue} today={today} className={DATE_CONTROL} rootClassName={RANGE_ROOT} />;
}

type Unit = {
  readonly labels: 'dayRange' | 'monthRange';
  readonly Field: (props: RangeFieldProps) => ReactNode;
  readonly shownRange: (range: DayRange) => DayRange;
};

const UNITS: Readonly<Record<Granularity, Unit>> = {
  day: { labels: 'dayRange', Field: DayField, shownRange: (range) => range },
  month: {
    labels: 'monthRange',
    Field: MonthField,
    shownRange: monthRangeOf,
  },
};

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
  const [pushes, setPushes] = useState(0);
  const fields = useRef<HTMLDivElement>(null);

  const submitPreset = (range: DayRange): void => {
    const shown = unit.shownRange(range);
    flushSync(() => {
      setFrom(shown.from);
      setTo(shown.to);
      setPushes((count) => count + 1);
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
          <unit.Field
            key={pushes}
            id={`${id}-from`}
            name={names.from}
            value={from}
            onValue={setFrom}
            today={today}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${id}-to`}>{t('to')}</label>
          <unit.Field
            key={pushes}
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
