import { type AccountType } from '@repo/contracts';
import {
  FallingLineIcon,
  PieIcon,
  ReceiptIcon,
  RisingLineIcon,
  SparkleIcon,
  WalletIcon,
} from '@repo/ui';
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

type StripProps = {
  readonly icon: ReactNode;
  readonly name: string;
  readonly id: string;
  readonly className: string;
  readonly children?: ReactNode;
};

function Strip({ icon, name, id, className, children }: StripProps): ReactNode {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-control ${className}`}>
      <span
        id={id}
        className={`flex items-center gap-2 ${typeClasses['body-sm']} font-semibold text-text`}
      >
        <span className="flex shrink-0">{icon}</span>
        {name}
      </span>
      {children}
    </div>
  );
}

export type BandProps = {
  readonly accountType: AccountType;
  readonly id: string;
  readonly className: string;
  readonly children?: ReactNode;
};

export function Band({ accountType, id, className, children }: BandProps): ReactNode {
  const Icon = TYPE_ICON[accountType];
  return (
    <Strip
      icon={<Icon />}
      name={en.accountTypes[accountType]}
      id={id}
      className={`bg-band ${className}`}
    >
      {children}
    </Strip>
  );
}

export type SuggestedBandProps = {
  readonly id: string;
  readonly className: string;
};

export function SuggestedBand({ id, className }: SuggestedBandProps): ReactNode {
  return (
    <Strip
      icon={<SparkleIcon />}
      name={en.accountSheet.suggested}
      id={id}
      className={`bg-band-suggested ${className}`}
    />
  );
}
