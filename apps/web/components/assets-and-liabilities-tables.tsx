import { useTranslations } from 'next-intl';
import { type AccountId, type AssetsAndLiabilitiesOutput, type AssetsAndLiabilitiesQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesAnswer } from '../server/assets-and-liabilities';
import { type Shown } from '../server/report-outcome';
import { accountSearchPath } from '../server/return-path';
import { type KeepCollapsed } from './statement-group';
import { StatementTables } from './statement-tables';
import { DANGER_TEXT } from './text-classes';

type AssetsAndLiabilitiesTablesProps = {
  readonly report: AssetsAndLiabilitiesOutput;
  readonly day: AssetsAndLiabilitiesQuery;
  readonly keep: KeepCollapsed;
};

function AssetsAndLiabilitiesTables({ report, day, keep }: AssetsAndLiabilitiesTablesProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  const hrefOf = (account: AccountId): string => accountSearchPath(account, { to: day.date });

  return (
    <StatementTables
      left={{ accountType: 'asset', totalLabel: t('totalAssets'), section: report.assets, hrefOf }}
      right={{ accountType: 'liability', totalLabel: t('totalLiabilities'), section: report.liabilities, hrefOf }}
      totals={{
        caption: t('totals'),
        rows: [
          { label: t('totalAssets'), amount: report.assets.total },
          { label: t('totalLiabilities'), amount: report.liabilities.total },
        ],
        result: { label: t('netWorth'), amount: report.netWorth },
      }}
      keep={keep}
    />
  );
}

export type AssetsAndLiabilitiesOutcomeProps = {
  readonly answer: Shown<AssetsAndLiabilitiesAnswer>;
  readonly keep: KeepCollapsed;
};

export function AssetsAndLiabilitiesOutcome({ answer, keep }: AssetsAndLiabilitiesOutcomeProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  if (answer.outcome === 'answered') {
    return <AssetsAndLiabilitiesTables report={answer.report} day={answer.day} keep={keep} />;
  }
  return (
    <p role="alert" className={DANGER_TEXT}>
      {t('refused')}
    </p>
  );
}
