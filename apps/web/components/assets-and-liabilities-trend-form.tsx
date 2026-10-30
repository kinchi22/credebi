'use client';

import { useTranslations } from 'next-intl';
import { ASSETS_AND_LIABILITIES_TREND_FIELDS } from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { useId, type ReactNode } from 'react';
import { type TrendRange } from '../server/assets-and-liabilities-trend';
import { ASSETS_AND_LIABILITIES_TREND_PATH } from '../server/return-path';
import { PRIMARY_BUTTON } from './control-classes';
import { RangeFields } from './range-fields';
import { useBrowserToday } from './use-browser-today';

export type AssetsAndLiabilitiesTrendFormProps = {
  readonly range: TrendRange;
};

export function AssetsAndLiabilitiesTrendForm({ range }: AssetsAndLiabilitiesTrendFormProps): ReactNode {
  const t = useTranslations('assetsAndLiabilitiesTrend');
  const id = useId();
  const today = useBrowserToday();

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

      <RangeFields
        granularity="month"
        names={ASSETS_AND_LIABILITIES_TREND_FIELDS}
        from={range.from}
        to={range.to}
        today={today}
      >
        <button type="submit" className={PRIMARY_BUTTON}>
          {t('show')}
        </button>
      </RangeFields>
    </form>
  );
}
