'use client';

import { SEARCH_CRITERIA_FIELDS, type SearchCriteriaInput } from '@repo/contracts';
import { CHART_OF_ACCOUNTS, type DayRange } from '@repo/core/entries';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH } from '../server/return-path';
import { useBrowserToday } from './browser-today';
import { CONTROL, FIELD, PRIMARY_BUTTON } from './control-classes';
import { DatePresets, DatePresetsSheet } from './date-presets';

export type EntrySearchFormProps = {
  readonly criteria: SearchCriteriaInput;
};

const DATE_CONTROL = `w-full min-w-0 appearance-none wide:w-auto ${typeClasses.date}`;

function keepingADay(set: (day: string) => void): (event: ChangeEvent<HTMLInputElement>) => void {
  return (event) => {
    if (event.target.value !== '') {
      set(event.target.value);
    }
  };
}

export function EntrySearchForm({ criteria }: EntrySearchFormProps): ReactNode {
  const id = useId();
  const [from, setFrom] = useState(criteria.from ?? '');
  const [to, setTo] = useState(criteria.to ?? '');
  const form = useRef<HTMLFormElement>(null);
  const today = useBrowserToday();

  const searchPreset = (range: DayRange): void => {
    flushSync(() => {
      setFrom(range.from);
      setTo(range.to);
    });
    form.current?.requestSubmit();
  };

  return (
    <form
      ref={form}
      aria-labelledby={`${id}-title`}
      action={ENTRY_SEARCH_PATH}
      method="get"
      className={`flex flex-wrap items-end gap-3 ${PANEL}`}
    >
      <h2
        id={`${id}-title`}
        className={`w-full ${typeClasses.label} text-text-muted`}
      >
        {en.entrySearch.title}
      </h2>

      <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 wide:contents">
        <div className={FIELD}>
          <label htmlFor={`${id}-from`}>{en.entrySearch.from}</label>
          <input
            id={`${id}-from`}
            name={SEARCH_CRITERIA_FIELDS.from}
            type="date"
            value={from}
            onChange={keepingADay(setFrom)}
            required
            className={`${CONTROL} ${DATE_CONTROL}`}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor={`${id}-to`}>{en.entrySearch.to}</label>
          <input
            id={`${id}-to`}
            name={SEARCH_CRITERIA_FIELDS.to}
            type="date"
            value={to}
            onChange={keepingADay(setTo)}
            required
            className={`${CONTROL} ${DATE_CONTROL}`}
          />
        </div>
        <DatePresetsSheet today={today} onChoose={searchPreset} />
      </div>

      <div className={FIELD}>
        <label htmlFor={`${id}-account`}>{en.entrySearch.account}</label>
        <select
          id={`${id}-account`}
          name={SEARCH_CRITERIA_FIELDS.account}
          defaultValue={criteria.account ?? ''}
          className={CONTROL}
        >
          <option value="">{en.entrySearch.anyAccount}</option>
          {CHART_OF_ACCOUNTS.map((code) => (
            <option key={code} value={code}>
              {en.accounts[code]}
            </option>
          ))}
        </select>
      </div>

      <div className={`${FIELD} grow`}>
        <label htmlFor={`${id}-memo`}>{en.entrySearch.memo}</label>
        <input
          id={`${id}-memo`}
          name={SEARCH_CRITERIA_FIELDS.memo}
          type="text"
          defaultValue={criteria.memo ?? ''}
          className={CONTROL}
        />
      </div>

      <button
        type="submit"
        className={PRIMARY_BUTTON}
      >
        {en.entrySearch.submit}
      </button>

      <DatePresets today={today} onChoose={searchPreset} />
    </form>
  );
}
