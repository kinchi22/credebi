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

type IconSize = 14 | 16;

const TYPE_ICON: Readonly<Record<AccountType, (props: { readonly size: IconSize }) => ReactNode>> = {
  asset: WalletIcon,
  liability: ReceiptIcon,
  equity: PieIcon,
  revenue: RisingLineIcon,
  expense: FallingLineIcon,
};

type TypeHue = {
  readonly tint: string;
  readonly stroke: string;
};

const TYPE_HUE: Readonly<Record<AccountType, TypeHue>> = {
  asset: { tint: 'bg-type-asset-tint', stroke: 'text-type-asset' },
  liability: { tint: 'bg-type-liability-tint', stroke: 'text-type-liability' },
  equity: { tint: 'bg-type-equity-tint', stroke: 'text-type-equity' },
  revenue: { tint: 'bg-type-revenue-tint', stroke: 'text-type-revenue' },
  expense: { tint: 'bg-type-expense-tint', stroke: 'text-type-expense' },
};

export type TypeIconProps = {
  readonly accountType: AccountType;
  readonly size?: IconSize;
};

export function TypeIcon({ accountType, size = 16 }: TypeIconProps): ReactNode {
  const Icon = TYPE_ICON[accountType];
  return <Icon size={size} />;
}

export function TypeTile({ accountType }: { readonly accountType: AccountType }): ReactNode {
  const hue = TYPE_HUE[accountType];
  return (
    <span
      data-testid="type-tile"
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-control ${hue.tint} ${hue.stroke}`}
    >
      <TypeIcon accountType={accountType} size={14} />
    </span>
  );
}

type StripProps = {
  readonly icon: ReactNode;
  readonly stroke?: string;
  readonly name: string;
  readonly id: string;
  readonly className: string;
  readonly children?: ReactNode;
};

function Strip({ icon, stroke = '', name, id, className, children }: StripProps): ReactNode {
  return (
    <div
      data-testid="band"
      className={`flex items-center justify-between gap-3 rounded-control ${className}`}
    >
      <span
        id={id}
        className={`flex items-center gap-2 ${typeClasses['body-sm']} font-semibold text-text`}
      >
        <span className={`flex shrink-0 ${stroke}`}>{icon}</span>
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

export type DirectionArrowProps = {
  readonly direction: BalanceDirection;
  readonly className?: string;
};

export function DirectionArrow({ direction, className = '' }: DirectionArrowProps): ReactNode {
  const Icon = DIRECTION_ICON[direction];
  return (
    <span data-testid="balance-direction" className={`flex shrink-0 text-text-muted ${className}`}>
      <Icon />
    </span>
  );
}

function Hint({ direction }: { readonly direction: BalanceDirection }): ReactNode {
  const t = useTranslations();
  return (
    <span
      className={`flex shrink-0 items-center gap-1 ${typeClasses['body-sm']} text-text-muted`}
    >
      <DirectionArrow direction={direction} />
      {t(`accountSheet.${direction}`)}
    </span>
  );
}

export function Band({ accountType, id, className, direction, children }: BandProps): ReactNode {
  const t = useTranslations();
  const hue = TYPE_HUE[accountType];
  return (
    <Strip
      icon={<TypeIcon accountType={accountType} />}
      stroke={hue.stroke}
      name={t(`accountTypes.${accountType}`)}
      id={id}
      className={`${hue.tint} ${className}`}
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
