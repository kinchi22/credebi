import { useTranslations } from 'next-intl';
import { type AccountId, type IncomeStatementOutput, type IncomeStatementQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { accountSearchPath } from '../server/return-path';
import { type KeepCollapsed } from './statement-group';
import { StatementTables } from './statement-tables';
import { DANGER_TEXT } from './text-classes';

export type IncomeStatementTablesProps = {
  readonly statement: IncomeStatementOutput;
  readonly period: IncomeStatementQuery;
  readonly keep: KeepCollapsed;
};

export function IncomeStatementTables({ statement, period, keep }: IncomeStatementTablesProps): ReactNode {
  const t = useTranslations('incomeStatement');
  const hrefOf = (account: AccountId): string => accountSearchPath(account, period);

  return (
    <StatementTables
      left={{ accountType: 'expense', totalLabel: t('totalExpense'), section: statement.expense, hrefOf }}
      right={{ accountType: 'revenue', totalLabel: t('totalRevenue'), section: statement.revenue, hrefOf }}
      stackRightFirst
      totals={{
        caption: t('totals'),
        rows: [
          { label: t('totalRevenue'), amount: statement.revenue.total },
          { label: t('totalExpense'), amount: statement.expense.total },
        ],
        result: { label: t('netIncome'), amount: statement.netIncome },
      }}
      keep={keep}
    />
  );
}

export type IncomeStatementOutcomeProps = {
  readonly answer: IncomeStatementAnswer;
  readonly keep: KeepCollapsed;
};

export function IncomeStatementOutcome({ answer, keep }: IncomeStatementOutcomeProps): ReactNode {
  const t = useTranslations('incomeStatement');
  if (answer.outcome === 'answered') {
    return <IncomeStatementTables statement={answer.statement} period={answer.period} keep={keep} />;
  }
  return (
    <p role="alert" className={DANGER_TEXT}>
      {t(answer.outcome)}
    </p>
  );
}
