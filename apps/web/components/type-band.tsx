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

export const TYPE_BAND = 'rounded-control bg-band';

export const TYPE_NAME = `flex items-center gap-2 ${typeClasses['body-sm']} font-semibold text-text`;

export function TypeName({ accountType }: { readonly accountType: AccountType }): ReactNode {
  const Icon = TYPE_ICON[accountType];
  return (
    <>
      <span className="flex shrink-0">
        <Icon />
      </span>
      {en.accountTypes[accountType]}
    </>
  );
}
