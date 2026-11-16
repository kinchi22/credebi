'use client';

import { type AccountId, type Money } from '@repo/contracts';
import { ChevronIcon } from '@repo/ui';
import { type ReactNode, useId, useState } from 'react';
import { AmountRow } from './amount-row';

const CONTROL = 'flex w-full items-center gap-1 py-2 text-left font-medium';
const CHEVRON = 'inline-flex shrink-0 text-text-muted';

export type StatementGroupAccount = {
  readonly account: AccountId;
  readonly name: string;
  readonly total: Money;
  readonly href: string | undefined;
};

export type StatementGroupProps = {
  readonly name: string;
  readonly total: Money;
  readonly accounts: readonly StatementGroupAccount[];
};

export function StatementGroup({ name, total, accounts }: StatementGroupProps): ReactNode {
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  const rows = accounts.map((account) => ({ ...account, id: `${id}${account.account}` }));

  return (
    <>
      <AmountRow
        label={
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={rows.map((row) => row.id).join(' ')}
            onClick={() => {
              setExpanded(!expanded);
            }}
            className={CONTROL}
          >
            <span className="min-w-0">{name}</span>
            <span className={`${CHEVRON} ${expanded ? 'rotate-90' : ''}`}>
              <ChevronIcon />
            </span>
          </button>
        }
        amount={total}
        variant="group"
      />
      {rows.map((row) => (
        <AmountRow
          key={row.account}
          id={row.id}
          hidden={!expanded}
          label={row.name}
          amount={row.total}
          variant="grouped"
          href={row.href}
        />
      ))}
    </>
  );
}
