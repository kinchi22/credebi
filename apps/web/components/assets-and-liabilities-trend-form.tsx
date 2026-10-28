import { useTranslations } from 'next-intl';
import { ASSETS_AND_LIABILITIES_TREND_FIELDS } from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { useId, type ReactNode } from 'react';
import { type TrendRange } from '../server/assets-and-liabilities-trend';
import { ASSETS_AND_LIABILITIES_TREND_PATH } from '../server/return-path';
import { DATE_CONTROL, FIELD, PRIMARY_BUTTON } from './control-classes';

export type AssetsAndLiabilitiesTrendFormProps = {
  readonly range: TrendRange;
};

export function AssetsAndLiabilitiesTrendForm({ range }: AssetsAndLiabilitiesTrendFormProps): ReactNode {
  const t = useTranslations('assetsAndLiabilitiesTrend');
  const id = useId();
  const fields = [
    { name: ASSETS_AND_LIABILITIES_TREND_FIELDS.from, label: t('from'), value: range.from },
    { name: ASSETS_AND_LIABILITIES_TREND_FIELDS.to, label: t('to'), value: range.to },
  ];

  return (
    <form
      aria-labelledby={`${id}-title`}
      action={ASSETS_AND_LIABILITIES_TREND_PATH}
      method="get"
      className={`flex flex-wrap items-end gap-3 ${PANEL}`}
    >
      <h2 id={`${id}-title`} className={`w-full ${PANEL_TITLE}`}>
        {t('range')}
      </h2>

      {fields.map(({ name, label, value }) => (
        <div key={name} className={FIELD}>
          <label htmlFor={`${id}-${name}`}>{label}</label>
          <input
            id={`${id}-${name}`}
            name={name}
            type="month"
            defaultValue={value ?? ''}
            required
            autoComplete="off"
            className={DATE_CONTROL}
          />
        </div>
      ))}

      <button type="submit" className={PRIMARY_BUTTON}>
        {t('show')}
      </button>
    </form>
  );
}
