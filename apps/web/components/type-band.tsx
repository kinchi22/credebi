import { type AccountType } from '@repo/contracts';
import { FallingLineIcon, PieIcon, ReceiptIcon, RisingLineIcon, WalletIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { en } from '../messages/en';

const TYPE_ICON: Readonly<Record<AccountType, () => ReactNode>> = {
  asset: WalletIcon,
  liability: ReceiptIcon,
  equity: PieIcon,
  revenue: RisingLineIcon,
  expense: FallingLineIcon,
};

export type BandProps = {
  readonly accountType: AccountType;
  readonly id: string;
  readonly className: string;
  readonly children?: ReactNode;
};

export function Band({ accountType, id, className, children }: BandProps): ReactNode {
  const Icon = TYPE_ICON[accountType];
  return (
    <div className={`flex items-center justify-between gap-3 rounded-control bg-band ${className}`}>
      <span
        id={id}
        className={`flex items-center gap-2 ${typeClasses['body-sm']} font-semibold text-text`}
      >
        <span className="flex shrink-0">
          <Icon />
        </span>
        {en.accountTypes[accountType]}
      </span>
      {children}
    </div>
  );
}
