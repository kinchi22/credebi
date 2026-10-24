import { useTranslations } from 'next-intl';
import { type IncomeStatementOutput, type Money, type StatementSectionOutput } from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { formatAmount } from './amount';
import { DANGER_TEXT } from './text-classes';

const TABLE = `w-full border-collapse ${typeClasses['body-sm']}`;
const CAPTION = `mb-2 text-left ${PANEL_TITLE}`;
const ROW = 'border-b border-border last:border-b-0';
const LABEL = 'py-2 pr-3 text-left font-normal wrap-anywhere';
const AMOUNT = `py-2 text-right whitespace-nowrap ${typeClasses.figure}`;
const TOTAL_ROW = 'border-t-2 border-border font-semibold';

type AmountRowProps = {
  readonly label: string;
  readonly amount: Money;
  readonly className?: string;
};

function AmountRow({ label, amount, className = ROW }: AmountRowProps): ReactNode {
  return (
    <tr className={className}>
      <th scope="row" className={LABEL}>
        {label}
      </th>
      <td className={AMOUNT}>{formatAmount(amount)}</td>
    </tr>
  );
}

type SectionTableProps = {
  readonly caption: string;
  readonly totalLabel: string;
  readonly section: StatementSectionOutput;
};

function SectionTable({ caption, totalLabel, section }: SectionTableProps): ReactNode {
  return (
    <div className={PANEL}>
      <table className={TABLE}>
        <caption className={CAPTION}>{caption}</caption>
        <tbody>
          {section.rows.map((row) => (
            <AmountRow key={row.account} label={row.name} amount={row.total} />
          ))}
        </tbody>
        <tfoot>
          <AmountRow label={totalLabel} amount={section.total} className={TOTAL_ROW} />
        </tfoot>
      </table>
    </div>
  );
}

export type IncomeStatementTablesProps = {
  readonly statement: IncomeStatementOutput;
};

export function IncomeStatementTables({ statement }: IncomeStatementTablesProps): ReactNode {
  const t = useTranslations('incomeStatement');

  return (
    <>
      <SectionTable caption={t('revenue')} totalLabel={t('totalRevenue')} section={statement.revenue} />
      <SectionTable caption={t('expenses')} totalLabel={t('totalExpense')} section={statement.expense} />
      <div className={PANEL}>
        <table className={TABLE}>
          <caption className={CAPTION}>{t('totals')}</caption>
          <tbody>
            <AmountRow label={t('totalRevenue')} amount={statement.revenue.total} />
            <AmountRow label={t('totalExpense')} amount={statement.expense.total} />
            <AmountRow label={t('difference')} amount={statement.difference} className={TOTAL_ROW} />
          </tbody>
        </table>
      </div>
    </>
  );
}

export type IncomeStatementOutcomeProps = {
  readonly answer: IncomeStatementAnswer;
};

export function IncomeStatementOutcome({ answer }: IncomeStatementOutcomeProps): ReactNode {
  const t = useTranslations('incomeStatement');
  if (answer.outcome === 'answered') {
    return <IncomeStatementTables statement={answer.statement} />;
  }
  return (
    <p role="alert" className={DANGER_TEXT}>
      {t(answer.outcome)}
    </p>
  );
}
