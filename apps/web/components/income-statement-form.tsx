'use client';

import { useTranslations } from 'next-intl';
import { INCOME_STATEMENT_FIELDS } from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { useId, type ReactNode } from 'react';
import { type StatementPeriod } from '../server/income-statement';
import { INCOME_STATEMENT_PATH } from '../server/return-path';
import { PRIMARY_BUTTON } from './control-classes';
import { RangeFields } from './range-fields';
import { useBrowserToday } from './use-browser-today';

export type IncomeStatementFormProps = {
  readonly period: StatementPeriod;
};

export function IncomeStatementForm({ period }: IncomeStatementFormProps): ReactNode {
  const t = useTranslations('incomeStatement');
  const id = useId();
  const today = useBrowserToday();

  return (
    <form
      aria-labelledby={`${id}-title`}
      action={INCOME_STATEMENT_PATH}
      method="get"
      className={`flex flex-wrap items-end gap-3 ${PANEL}`}
    >
      <h2 id={`${id}-title`} className={`w-full ${PANEL_TITLE}`}>
        {t('period')}
      </h2>

      <RangeFields granularity="day" names={INCOME_STATEMENT_FIELDS} from={period.from} to={period.to} today={today}>
        <button type="submit" className={PRIMARY_BUTTON}>
          {t('show')}
        </button>
      </RangeFields>
    </form>
  );
}
