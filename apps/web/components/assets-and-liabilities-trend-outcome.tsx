import { useTranslations } from 'next-intl';
import { type AssetsAndLiabilitiesTrendOutput } from '@repo/contracts';
import { monthOf, MOST_TREND_MONTHS, yearOf } from '@repo/core/entries';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesTrendAnswer } from '../server/assets-and-liabilities-trend';
import { formatAmount } from './amount';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

type TrendTableProps = {
  readonly months: AssetsAndLiabilitiesTrendOutput['months'];
};

function TrendTable({ months }: TrendTableProps): ReactNode {
  const t = useTranslations();
  const monthLabel = (month: string): string =>
    t('datePresets.periodOfYear', {
      period: t('datePresets.month', { month: monthOf(month) }),
      year: String(yearOf(month)).padStart(4, '0'),
    });

  return (
    <table className="sr-only">
      <caption>{t('assetsAndLiabilitiesTrendPage.title')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('assetsAndLiabilitiesTrend.month')}</th>
          <th scope="col">{t('assetsAndLiabilities.totalAssets')}</th>
          <th scope="col">{t('assetsAndLiabilities.totalLiabilities')}</th>
          <th scope="col">{t('assetsAndLiabilities.netWorth')}</th>
        </tr>
      </thead>
      <tbody>
        {months.map(({ month, totalAssets, totalLiabilities, netWorth }) => (
          <tr key={month}>
            <th scope="row">{monthLabel(month)}</th>
            <td>{formatAmount(totalAssets)}</td>
            <td>{formatAmount(totalLiabilities)}</td>
            <td>{formatAmount(netWorth)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type AssetsAndLiabilitiesTrendOutcomeProps = {
  readonly answer: AssetsAndLiabilitiesTrendAnswer;
};

export function AssetsAndLiabilitiesTrendOutcome({ answer }: AssetsAndLiabilitiesTrendOutcomeProps): ReactNode {
  const t = useTranslations('assetsAndLiabilitiesTrend');
  if (answer.outcome !== 'answered') {
    return (
      <p role="alert" className={DANGER_TEXT}>
        {answer.outcome === 'refused' ? t('refused', { most: String(MOST_TREND_MONTHS) }) : t('unavailable')}
      </p>
    );
  }
  if (!answer.trend.recorded) {
    return <p className={MUTED_TEXT}>{t('nothingRecorded')}</p>;
  }
  return <TrendTable months={answer.trend.months} />;
}
