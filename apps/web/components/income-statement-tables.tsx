import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  type IncomeStatementOutput,
  type IncomeStatementQuery,
  type Money,
  type StatementSectionOutput,
} from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { type IncomeStatementAnswer } from '../server/income-statement';
import { accountSearchPath } from '../server/return-path';
import { formatAmount } from './amount';
import { type StatementSectionName, totalsUnder } from './statement-columns';
import { DANGER_TEXT, LINK, MUTED_TEXT } from './text-classes';

const TABLE = `w-full border-collapse ${typeClasses['body-sm']}`;
const CAPTION = `mb-2 text-left ${PANEL_TITLE}`;
const ROW = 'border-b border-border last:border-b-0';
const LABEL = 'py-2 pr-3 text-left wrap-anywhere';
const AMOUNT = `py-2 text-right whitespace-nowrap ${typeClasses.figure}`;
const TOTAL_ROW = 'border-t-2 border-border font-semibold';
const COLUMNS = 'flex flex-col gap-4 split:grid split:grid-cols-2 split:grid-rows-[auto_1fr] split:items-start';

type Placement = { readonly revenue: string; readonly expense: string; readonly totals: string };

const PLACEMENT: Readonly<Record<StatementSectionName, Placement>> = {
  revenue: {
    revenue: 'split:col-start-2 split:row-start-1',
    expense: 'split:col-start-1 split:row-span-2 split:row-start-1',
    totals: 'split:col-start-2 split:row-start-2',
  },
  expense: {
    revenue: 'split:col-start-2 split:row-span-2 split:row-start-1',
    expense: 'split:col-start-1 split:row-start-1',
    totals: 'split:col-start-1 split:row-start-2',
  },
};

type AmountRowVariant = 'account' | 'group' | 'grouped' | 'total';

const ROW_CLASSES: Readonly<Record<AmountRowVariant, { readonly row: string; readonly label: string }>> = {
  account: { row: ROW, label: `${LABEL} font-normal` },
  group: { row: ROW, label: `${LABEL} font-medium` },
  grouped: { row: ROW, label: `${LABEL} pl-4 font-normal` },
  total: { row: TOTAL_ROW, label: `${LABEL} font-semibold` },
};

type AmountRowProps = {
  readonly label: string;
  readonly amount: Money;
  readonly variant?: AmountRowVariant;
  readonly href?: string;
};

function AmountRow({ label, amount, variant = 'account', href }: AmountRowProps): ReactNode {
  const classes = ROW_CLASSES[variant];
  return (
    <tr className={classes.row}>
      <th scope="row" className={classes.label}>
        {href === undefined ? (
          label
        ) : (
          <Link href={href} className={LINK}>
            {label}
          </Link>
        )}
      </th>
      <td className={AMOUNT}>{formatAmount(amount)}</td>
    </tr>
  );
}

type SectionTableProps = {
  readonly caption: string;
  readonly totalLabel: string;
  readonly section: StatementSectionOutput;
  readonly period: IncomeStatementQuery;
  readonly placement: string;
};

function SectionTable({ caption, totalLabel, section, period, placement }: SectionTableProps): ReactNode {
  return (
    <div className={`${PANEL} ${placement}`}>
      <table className={TABLE}>
        <caption className={CAPTION}>{caption}</caption>
        <tbody>
          {section.rows.flatMap((row) =>
            row.kind === 'account'
              ? [
                  <AmountRow
                    key={row.account}
                    label={row.name}
                    amount={row.total}
                    href={accountSearchPath(row.account, period)}
                  />,
                ]
              : [
                  <AmountRow
                    key={row.group}
                    label={row.name}
                    amount={row.total}
                    variant="group"
                  />,
                  ...row.accounts.map((account) => (
                    <AmountRow
                      key={account.account}
                      label={account.name}
                      amount={account.total}
                      variant="grouped"
                      href={accountSearchPath(account.account, period)}
                    />
                  )),
                ],
          )}
        </tbody>
        <tfoot>
          <AmountRow label={totalLabel} amount={section.total} variant="total" />
        </tfoot>
      </table>
    </div>
  );
}

export type IncomeStatementTablesProps = {
  readonly statement: IncomeStatementOutput;
  readonly period: IncomeStatementQuery;
};

export function IncomeStatementTables({ statement, period }: IncomeStatementTablesProps): ReactNode {
  const t = useTranslations('incomeStatement');
  const placement = PLACEMENT[totalsUnder(statement)];

  return (
    <div className={COLUMNS}>
      <SectionTable
        caption={t('revenue')}
        totalLabel={t('totalRevenue')}
        section={statement.revenue}
        period={period}
        placement={placement.revenue}
      />
      <SectionTable
        caption={t('expenses')}
        totalLabel={t('totalExpense')}
        section={statement.expense}
        period={period}
        placement={placement.expense}
      />
      <div className={`${PANEL} ${placement.totals}`}>
        <table className={TABLE}>
          <caption className={CAPTION}>{t('totals')}</caption>
          <tbody>
            <AmountRow label={t('totalRevenue')} amount={statement.revenue.total} />
            <AmountRow label={t('totalExpense')} amount={statement.expense.total} />
            <AmountRow label={t('netIncome')} amount={statement.netIncome} variant="total" />
          </tbody>
        </table>
      </div>
    </div>
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
