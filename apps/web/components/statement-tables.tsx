import Link from 'next/link';
import {
  type AccountId,
  type AccountType,
  type Money,
  type StatementSectionOutput,
} from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode, useId } from 'react';
import { formatAmount } from './amount';
import { type StatementColumn, totalsUnder } from './statement-columns';
import { LINK } from './text-classes';
import { Band } from './type-band';

const TABLE = `w-full border-collapse ${typeClasses['body-sm']}`;
const CAPTION = `mb-2 text-left ${PANEL_TITLE}`;
const ROW = 'border-b border-border last:border-b-0';
const LABEL = 'py-2 pr-3 text-left wrap-anywhere';
const AMOUNT = `py-2 text-right whitespace-nowrap ${typeClasses.figure}`;
const TOTAL_ROW = 'border-t-2 border-border font-semibold';
const COLUMNS = 'flex flex-col gap-4 split:grid split:grid-cols-2 split:grid-rows-[auto_1fr] split:items-start';

type Placement = { readonly left: string; readonly right: string; readonly totals: string };

const PLACEMENT: Readonly<Record<StatementColumn, Placement>> = {
  left: {
    left: 'split:col-start-1 split:row-start-1',
    right: 'split:col-start-2 split:row-span-2 split:row-start-1',
    totals: 'split:col-start-1 split:row-start-2',
  },
  right: {
    left: 'split:col-start-1 split:row-span-2 split:row-start-1',
    right: 'split:col-start-2 split:row-start-1',
    totals: 'split:col-start-2 split:row-start-2',
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
  readonly href?: string | undefined;
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

export type StatementSectionTable = {
  readonly accountType: AccountType;
  readonly totalLabel: string;
  readonly section: StatementSectionOutput;
  readonly hrefOf?: (account: AccountId) => string;
};

type SectionTableProps = StatementSectionTable & { readonly placement: string };

function SectionTable({ accountType, totalLabel, section, hrefOf, placement }: SectionTableProps): ReactNode {
  const id = useId();
  return (
    <div className={`${PANEL} ${placement}`}>
      <table className={TABLE}>
        <caption className="mb-2">
          <Band accountType={accountType} id={id} className="px-3 py-2" />
        </caption>
        <tbody>
          {section.rows.flatMap((row) =>
            row.kind === 'account'
              ? [
                  <AmountRow
                    key={row.account}
                    label={row.name}
                    amount={row.total}
                    href={hrefOf?.(row.account)}
                  />,
                ]
              : [
                  <AmountRow key={row.group} label={row.name} amount={row.total} variant="group" />,
                  ...row.accounts.map((account) => (
                    <AmountRow
                      key={account.account}
                      label={account.name}
                      amount={account.total}
                      variant="grouped"
                      href={hrefOf?.(account.account)}
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

export type StatementTotalsTable = {
  readonly caption: string;
  readonly rows: readonly { readonly label: string; readonly amount: Money }[];
  readonly result: { readonly label: string; readonly amount: Money };
};

export type StatementTablesProps = {
  readonly left: StatementSectionTable;
  readonly right: StatementSectionTable;
  readonly stackRightFirst?: boolean;
  readonly totals: StatementTotalsTable;
};

export function StatementTables({ left, right, stackRightFirst = false, totals }: StatementTablesProps): ReactNode {
  const placement = PLACEMENT[totalsUnder(left.section, right.section)];
  const tables = [
    <SectionTable key="left" {...left} placement={placement.left} />,
    <SectionTable key="right" {...right} placement={placement.right} />,
  ];

  return (
    <div className={COLUMNS}>
      {stackRightFirst ? tables.toReversed() : tables}
      <div className={`${PANEL} ${placement.totals}`}>
        <table className={TABLE}>
          <caption className={CAPTION}>{totals.caption}</caption>
          <tbody>
            {totals.rows.map(({ label, amount }) => (
              <AmountRow key={label} label={label} amount={amount} />
            ))}
            <AmountRow label={totals.result.label} amount={totals.result.amount} variant="total" />
          </tbody>
        </table>
      </div>
    </div>
  );
}
