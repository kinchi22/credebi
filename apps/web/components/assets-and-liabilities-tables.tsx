import { useTranslations } from 'next-intl';
import { type AccountId, type AssetsAndLiabilitiesOutput, type AssetsAndLiabilitiesQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type AssetsAndLiabilitiesAnswer } from '../server/assets-and-liabilities';
import { accountSearchPath } from '../server/return-path';
import { type KeepCollapsed } from './statement-group';
import { StatementTables } from './statement-tables';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

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
  readonly answer: AssetsAndLiabilitiesAnswer;
  readonly keep: KeepCollapsed;
};

export function AssetsAndLiabilitiesOutcome({ answer, keep }: AssetsAndLiabilitiesOutcomeProps): ReactNode {
  const t = useTranslations('assetsAndLiabilities');
  if (answer.outcome === 'answered') {
    return <AssetsAndLiabilitiesTables report={answer.report} day={answer.day} keep={keep} />;
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
