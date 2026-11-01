import { useTranslations } from 'next-intl';
import { type AssetsAndLiabilitiesOutput } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesAnswer } from '../server/assets-and-liabilities';
import { StatementTables } from './statement-tables';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

type AssetsAndLiabilitiesTablesProps = {
  readonly report: AssetsAndLiabilitiesOutput;
};

function AssetsAndLiabilitiesTables({ report }: AssetsAndLiabilitiesTablesProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');

  return (
    <StatementTables
      left={{ accountType: 'asset', totalLabel: t('totalAssets'), section: report.assets }}
      right={{ accountType: 'liability', totalLabel: t('totalLiabilities'), section: report.liabilities }}
      totals={{
        caption: t('totals'),
        rows: [
          { label: t('totalAssets'), amount: report.assets.total },
          { label: t('totalLiabilities'), amount: report.liabilities.total },
        ],
        result: { label: t('netWorth'), amount: report.netWorth },
      }}
    />
  );
}

export type AssetsAndLiabilitiesOutcomeProps = {
  readonly answer: AssetsAndLiabilitiesAnswer;
};

export function AssetsAndLiabilitiesOutcome({ answer }: AssetsAndLiabilitiesOutcomeProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  if (answer.outcome === 'answered') {
    return <AssetsAndLiabilitiesTables report={answer.report} />;
  }
  return (
    <p role="alert" className={DANGER_TEXT}>
      {t(answer.outcome)}
    </p>
  );
}

export function AssetsAndLiabilitiesPending(): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  return (
    <section aria-busy className="flex flex-col gap-2">
      <p role="status" className={MUTED_TEXT}>
        {t('loading')}
      </p>
    </section>
  );
}
