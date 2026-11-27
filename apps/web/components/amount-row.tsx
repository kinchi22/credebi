import Link from 'next/link';
import { type Money } from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { formatAmount } from './amount';

const ROW = 'border-b border-border last:border-b-0';
const LABEL = 'pr-3 text-left wrap-anywhere';
const LABEL_PADDING = 'py-2';
const AMOUNT = `py-2 text-right whitespace-nowrap ${typeClasses.figure}`;
const ACCOUNT_LINK = 'text-inherit no-underline cursor-pointer';
const TOTAL_ROW = 'border-t-2 border-border font-semibold';

export type AmountRowVariant = 'account' | 'group' | 'grouped' | 'total';

const ROW_CLASSES: Readonly<Record<AmountRowVariant, { readonly row: string; readonly label: string }>> = {
  account: { row: ROW, label: `${LABEL} ${LABEL_PADDING} font-normal` },
  group: { row: ROW, label: `${LABEL} font-medium` },
  grouped: { row: ROW, label: `${LABEL} ${LABEL_PADDING} pl-4 font-normal` },
  total: { row: TOTAL_ROW, label: `${LABEL} ${LABEL_PADDING} font-semibold` },
};

export type AmountRowProps = {
  readonly label: ReactNode;
  readonly amount: Money;
  readonly variant?: AmountRowVariant;
  readonly href?: string | undefined;
  readonly id?: string;
  readonly hidden?: boolean;
};

export function AmountRow({ label, amount, variant = 'account', href, id, hidden }: AmountRowProps): ReactNode {
  const classes = ROW_CLASSES[variant];
  return (
    <tr id={id} hidden={hidden} className={classes.row}>
      <th scope="row" className={classes.label}>
        {href === undefined ? (
          label
        ) : (
          <Link href={href} className={ACCOUNT_LINK}>
            {label}
          </Link>
        )}
      </th>
      <td className={AMOUNT}>{formatAmount(amount)}</td>
    </tr>
  );
}
