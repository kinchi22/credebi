import { useTranslations } from 'next-intl';
import { ASSETS_AND_LIABILITIES_FIELDS } from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { useId, type ReactNode } from 'react';
import { type ReportDate } from '../server/assets-and-liabilities';
import { ASSETS_AND_LIABILITIES_PATH } from '../server/return-path';
import { DATE_CONTROL, FIELD, PRIMARY_BUTTON } from './control-classes';

export type AssetsAndLiabilitiesFormProps = {
  readonly asked: ReportDate;
};

export function AssetsAndLiabilitiesForm({ asked }: AssetsAndLiabilitiesFormProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  const id = useId();

  return (
    <form
      aria-labelledby={`${id}-title`}
      action={ASSETS_AND_LIABILITIES_PATH}
      method="get"
      className={`flex flex-wrap items-end gap-3 ${PANEL}`}
    >
      <h2 id={`${id}-title`} className={`w-full ${PANEL_TITLE}`}>
        {t('reportDate')}
      </h2>

      <div className={FIELD}>
        <label htmlFor={`${id}-date`}>{t('date')}</label>
        <input
          id={`${id}-date`}
          name={ASSETS_AND_LIABILITIES_FIELDS.date}
          type="date"
          defaultValue={asked.date ?? ''}
          required
          autoComplete="off"
          className={DATE_CONTROL}
        />
      </div>

      <button type="submit" className={PRIMARY_BUTTON}>
        {t('show')}
      </button>
    </form>
  );
}
