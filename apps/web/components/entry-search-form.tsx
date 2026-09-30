import { SEARCH_CRITERIA_FIELDS, type SearchCriteriaInput } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH } from '../server/return-path';
import { CONTROL, FIELD, PANEL, PRIMARY_BUTTON } from './control-classes';

export type EntrySearchFormProps = {
  readonly criteria: SearchCriteriaInput;
};

export function EntrySearchForm({ criteria }: EntrySearchFormProps): ReactNode {
  const id = useId();

  return (
    <form
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

      <div className={FIELD}>
        <label htmlFor={`${id}-from`}>{en.entrySearch.from}</label>
        <input
          id={`${id}-from`}
          name={SEARCH_CRITERIA_FIELDS.from}
          type="date"
          defaultValue={criteria.from ?? ''}
          className={`${CONTROL} ${typeClasses.date}`}
        />
      </div>
      <div className={FIELD}>
        <label htmlFor={`${id}-to`}>{en.entrySearch.to}</label>
        <input
          id={`${id}-to`}
          name={SEARCH_CRITERIA_FIELDS.to}
          type="date"
          defaultValue={criteria.to ?? ''}
          className={`${CONTROL} ${typeClasses.date}`}
        />
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
    </form>
  );
}
