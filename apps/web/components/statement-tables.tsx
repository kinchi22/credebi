import {
  type AccountId,
  type AccountType,
  type Money,
  type StatementSectionOutput,
} from '@repo/contracts';
import { PANEL, PANEL_TITLE } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode, useId } from 'react';
import { AmountRow } from './amount-row';
import { type StatementColumn, totalsUnder } from './statement-columns';
import { type KeepCollapsed, StatementGroup } from './statement-group';
import { Band } from './type-band';

const TABLE = `w-full border-collapse ${typeClasses['body-sm']}`;
const CAPTION = `mb-2 text-left ${PANEL_TITLE}`;
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

export type StatementSectionTable = {
  readonly accountType: AccountType;
  readonly totalLabel: string;
  readonly section: StatementSectionOutput;
  readonly hrefOf?: (account: AccountId) => string;
};

type SectionTableProps = StatementSectionTable & { readonly placement: string; readonly keep: KeepCollapsed };

function SectionTable({ accountType, totalLabel, section, hrefOf, placement, keep }: SectionTableProps): ReactNode {
  const id = useId();
  return (
    <div className={`${PANEL} ${placement}`}>
      <table className={TABLE}>
        <caption className="mb-2">
          <Band accountType={accountType} id={id} className="px-3 py-2" />
        </caption>
        <tbody>
          {section.rows.map((row) =>
            row.kind === 'account' ? (
              <AmountRow key={row.account} label={row.name} amount={row.total} href={hrefOf?.(row.account)} />
            ) : (
              <StatementGroup
                key={row.group}
                group={row.group}
                name={row.name}
                total={row.total}
                collapsed={row.collapsed}
                keep={keep}
                accounts={row.accounts.map(({ account, name, total }) => ({
                  account,
                  name,
                  total,
                  href: hrefOf?.(account),
                }))}
              />
            ),
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
  readonly keep: KeepCollapsed;
};

export function StatementTables({ left, right, stackRightFirst = false, totals, keep }: StatementTablesProps): ReactNode {
  const placement = PLACEMENT[totalsUnder(left.section, right.section)];
  const tables = [
    <SectionTable key="left" {...left} placement={placement.left} keep={keep} />,
    <SectionTable key="right" {...right} placement={placement.right} keep={keep} />,
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
