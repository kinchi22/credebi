import { useTranslations } from 'next-intl';
import { type AccountId, type IncomeStatementOutput, type IncomeStatementQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { accountSearchPath } from '../server/return-path';
import { StatementTables } from './statement-tables';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

export type IncomeStatementTablesProps = {
  readonly statement: IncomeStatementOutput;
  readonly period: IncomeStatementQuery;
};

export function IncomeStatementTables({ statement, period }: IncomeStatementTablesProps): ReactNode {
  const t = useTranslations('incomeStatement');
  const hrefOf = (account: AccountId): string => accountSearchPath(account, period);

  return (
    <StatementTables
      left={{ caption: t('expenses'), totalLabel: t('totalExpense'), section: statement.expense, hrefOf }}
      right={{ caption: t('revenue'), totalLabel: t('totalRevenue'), section: statement.revenue, hrefOf }}
      stackRightFirst
      totals={{
        caption: t('totals'),
        rows: [
          { label: t('totalRevenue'), amount: statement.revenue.total },
          { label: t('totalExpense'), amount: statement.expense.total },
        ],
        result: { label: t('netIncome'), amount: statement.netIncome },
      }}
    />
  );
}

export type IncomeStatementOutcomeProps = {
  readonly answer: IncomeStatementAnswer;
};

export function IncomeStatementOutcome({ answer }: IncomeStatementOutcomeProps): ReactNode {
  const t = useTranslations('incomeStatement');
  if (answer.outcome === 'answered') {
    return <IncomeStatementTables statement={answer.statement} period={answer.period} />;
  }
  return (
    <p role="alert" className={DANGER_TEXT}>
      {t(answer.outcome)}
    </p>
  );
}

export function IncomeStatementPending(): ReactNode {
  const t = useTranslations('incomeStatement');
  return (
    <section aria-busy className="flex flex-col gap-2">
      <p role="status" className={MUTED_TEXT}>
        {t('loading')}
      </p>
    </section>
  );
}
