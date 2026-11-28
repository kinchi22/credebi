import { useTranslations } from 'next-intl';
import { type AssetsAndLiabilitiesTrendOutput } from '@repo/contracts';
import { MOST_TREND_MONTHS } from '@repo/core/entries';
import { PANEL } from '@repo/ui';
import { type ReactNode } from 'react';
import { type ShownAssetsAndLiabilitiesTrendAnswer } from '../server/assets-and-liabilities-trend';
import { formatAmount } from './amount';
import { AssetsAndLiabilitiesTrendChart, type ShownLines } from './assets-and-liabilities-trend-chart';
import { SkeletonBlock, SkeletonSection } from './skeleton';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';
import { useMonthLabel } from './use-month-label';

type TrendTableProps = {
  readonly months: AssetsAndLiabilitiesTrendOutput['months'];
};

function TrendTable({ months }: TrendTableProps): ReactNode {
  const t = useTranslations();
  const monthLabel = useMonthLabel();

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
  readonly answer: ShownAssetsAndLiabilitiesTrendAnswer;
  readonly lines: ShownLines;
};

export function AssetsAndLiabilitiesTrendOutcome({ answer, lines }: AssetsAndLiabilitiesTrendOutcomeProps): ReactNode {
  const t = useTranslations('assetsAndLiabilitiesTrend');
  if (answer.outcome !== 'answered') {
    return (
      <p role="alert" className={DANGER_TEXT}>
        {t('refused', { most: String(MOST_TREND_MONTHS) })}
      </p>
    );
  }
  if (!answer.trend.recorded) {
    return <p className={MUTED_TEXT}>{t('nothingRecorded')}</p>;
  }
  return (
    <section className={`${PANEL} min-w-0`}>
      <AssetsAndLiabilitiesTrendChart months={answer.trend.months} lines={lines} />
      <TrendTable months={answer.trend.months} />
    </section>
  );
}

export function AssetsAndLiabilitiesTrendSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('assetsAndLiabilitiesTrendPage.title') })}
      className={`${PANEL} min-w-0`}
    >
      <SkeletonBlock className="h-80 wide:h-96" />
    </SkeletonSection>
  );
}
