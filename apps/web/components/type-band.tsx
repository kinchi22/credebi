import { useTranslations } from 'next-intl';
import { type AccountType } from '@repo/contracts';
import { type BalanceDirection } from '@repo/core/accounts';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FallingLineIcon,
  PieIcon,
  ReceiptIcon,
  RisingLineIcon,
  SparkleIcon,
  WalletIcon,
} from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';

const TYPE_ICON: Readonly<Record<AccountType, () => ReactNode>> = {
  asset: () => <WalletIcon size={16} />,
  liability: ReceiptIcon,
  equity: PieIcon,
  revenue: RisingLineIcon,
  expense: FallingLineIcon,
};

export type TypeIconProps = {
  readonly accountType: AccountType;
};

export function TypeIcon({ accountType }: TypeIconProps): ReactNode {
  const Icon = TYPE_ICON[accountType];
  return <Icon />;
}

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

const DIRECTION_ICON: Readonly<Record<BalanceDirection, () => ReactNode>> = {
  increase: ArrowUpIcon,
  decrease: ArrowDownIcon,
};

export type BandProps = {
  readonly accountType: AccountType;
  readonly id: string;
  readonly className: string;
  readonly direction?: BalanceDirection;
  readonly children?: ReactNode;
};

function Hint({ direction }: { readonly direction: BalanceDirection }): ReactNode {
  const t = useTranslations();
  const Icon = DIRECTION_ICON[direction];
  return (
    <span
      className={`flex shrink-0 items-center gap-1 ${typeClasses['body-sm']} text-text-muted`}
    >
      <Icon />
      {t(`accountSheet.${direction}`)}
    </span>
  );
}

export function Band({ accountType, id, className, direction, children }: BandProps): ReactNode {
  const t = useTranslations();
  return (
    <Strip
      icon={<TypeIcon accountType={accountType} />}
      name={t(`accountTypes.${accountType}`)}
      id={id}
      className={`bg-band ${className}`}
    >
      {direction === undefined ? null : <Hint direction={direction} />}
      {children}
    </Strip>
  );
}

export type SuggestedBandProps = {
  readonly id: string;
  readonly className: string;
};

export function SuggestedBand({ id, className }: SuggestedBandProps): ReactNode {
  const t = useTranslations();
  return (
    <Strip
      icon={<SparkleIcon />}
      name={t('accountSheet.suggested')}
      id={id}
      className={`bg-band-suggested ${className}`}
    />
  );
}
