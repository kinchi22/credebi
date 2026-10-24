'use client';

import { useTranslations } from 'next-intl';
import { type DayRange } from '@repo/core/entries';
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { DATE_CONTROL, FIELD } from './control-classes';
import { DatePresets, DatePresetsSheet } from './date-presets';

export type DayRangeFieldNames = {
  readonly from: string;
  readonly to: string;
};

export type DayRangeFieldsProps = {
  readonly names: DayRangeFieldNames;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly today: string | undefined;
  readonly children?: ReactNode;
};

const RANGE_DAY = `${DATE_CONTROL} w-full min-w-0 wide:w-auto`;

function keepingADay(set: (day: string) => void): (event: ChangeEvent<HTMLInputElement>) => void {
  return (event) => {
    if (event.target.value !== '') {
      set(event.target.value);
    }
  };
}

export function DayRangeFields({ names, from: initialFrom, to: initialTo, today, children }: DayRangeFieldsProps): ReactNode {
  const t = useTranslations('dayRange');
  const id = useId();
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const fromInput = useRef<HTMLInputElement>(null);

  const submitPreset = (range: DayRange): void => {
    flushSync(() => {
      setFrom(range.from);
      setTo(range.to);
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
            type="date"
            value={from}
            onChange={keepingADay(setFrom)}
            required
            className={RANGE_DAY}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${id}-to`}>{t('to')}</label>
          <input
            id={`${id}-to`}
            name={names.to}
            type="date"
            value={to}
            onChange={keepingADay(setTo)}
            required
            className={RANGE_DAY}
          />
        </div>
        <DatePresetsSheet today={today} onChoose={submitPreset} />
      </div>

      {children}

      <DatePresets today={today} onChoose={submitPreset} />
    </>
  );
}
