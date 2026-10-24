'use client';

import { useTranslations } from 'next-intl';
import {
  SEARCH_CRITERIA_FIELDS,
  accountsIn,
  type ChartOutput,
  type SearchCriteriaInput,
  type OfferedTitle,
} from '@repo/contracts';
import { endedLast } from '@repo/core/accounts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { useId, type ReactNode } from 'react';
import { ENTRY_SEARCH_PATH } from '../server/return-path';
import { useBrowserToday } from './use-browser-today';
import { CONTROL, FIELD, PRIMARY_BUTTON } from './control-classes';
import { DayRangeFields } from './day-range-fields';
import { AccountCombobox } from './account-combobox';
import { TitleCombobox } from './title-combobox';

export type EntrySearchFormProps = {
  readonly criteria: SearchCriteriaInput;
  readonly chart: ChartOutput;
  readonly titles: readonly OfferedTitle[];
};

export function EntrySearchForm({ criteria, chart, titles }: EntrySearchFormProps): ReactNode {
  const t = useTranslations();
  const id = useId();
  const today = useBrowserToday();
  const accounts = today === undefined ? accountsIn(chart) : endedLast(accountsIn(chart), today);

  return (
    <form
      aria-labelledby={`${id}-title`}
      action={ENTRY_SEARCH_PATH}
      method="get"
      className={`flex flex-wrap items-end gap-3 ${PANEL}`}
    >
      <h2
        id={`${id}-title`}
        className={`w-full ${PANEL_TITLE}`}
      >
        {t('entrySearch.title')}
      </h2>

      <DayRangeFields names={SEARCH_CRITERIA_FIELDS} from={criteria.from} to={criteria.to} today={today}>
        <AccountCombobox
          id={`${id}-account`}
          name={SEARCH_CRITERIA_FIELDS.account}
          label={t('entrySearch.account')}
          accounts={accounts}
          defaultValue={criteria.account}
        />

        <TitleCombobox
          id={`${id}-title-criterion`}
          name={SEARCH_CRITERIA_FIELDS.title}
          label={t('entrySearch.entryTitle')}
          defaultValue={criteria.title}
          titles={titles.map(({ title }) => title)}
          dense={false}
          className="grow"
        />

        <div className={`${FIELD} grow`}>
          <label htmlFor={`${id}-memo`}>{t('entrySearch.memo')}</label>
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
          {t('entrySearch.submit')}
        </button>
      </DayRangeFields>
    </form>
  );
}
