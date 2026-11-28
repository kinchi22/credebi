import { PANEL } from '@repo/ui';
import { type ReactNode } from 'react';

export function SkeletonBlock({ className }: { readonly className: string }): ReactNode {
  return <div aria-hidden="true" className={`rounded-control bg-skeleton ${className}`} />;
}

export function SkeletonLine({ className }: { readonly className: string }): ReactNode {
  return <SkeletonBlock className={`h-4 ${className}`} />;
}

export function SkeletonRow(): ReactNode {
  return (
    <div className="flex min-h-control items-center gap-3">
      <SkeletonBlock className="size-5 shrink-0" />
      <SkeletonLine className="w-2/5" />
      <SkeletonLine className="ml-auto w-1/5" />
    </div>
  );
}

export function SkeletonField({ className }: { readonly className: string }): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <SkeletonLine className="w-1/4" />
      <SkeletonBlock className={`h-control ${className}`} />
    </div>
  );
}

const ROWS_WHEN_COUNT_UNKNOWN = Array.from({ length: 3 }, (_, index) => index);

export function SkeletonRows({
  row: Row = SkeletonRow,
}: {
  readonly row?: () => ReactNode;
}): ReactNode {
  return ROWS_WHEN_COUNT_UNKNOWN.map((index) => <Row key={index} />);
}

export function SkeletonRowsPanel(): ReactNode {
  return (
    <div className={`${PANEL} flex flex-col gap-2`}>
      <SkeletonRows />
    </div>
  );
}

export type SkeletonSectionProps = {
  readonly message: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export function SkeletonSection({ message, className, children }: SkeletonSectionProps): ReactNode {
  return (
    <div aria-busy className={className}>
      <p role="status" className="sr-only">
        {message}
      </p>
      {children}
    </div>
  );
}
