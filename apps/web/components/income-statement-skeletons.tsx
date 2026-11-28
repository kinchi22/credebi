import { PANEL } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { SkeletonLine, SkeletonRows, SkeletonSection } from './skeleton';
import { STATEMENT_COLUMNS } from './statement-tables';

function TablePanelSkeleton(): ReactNode {
  return (
    <div className={`${PANEL} flex flex-col gap-2`}>
      <SkeletonLine className="w-1/3" />
      <SkeletonRows />
    </div>
  );
}

export function IncomeStatementSkeleton(): ReactNode {
  const t = useTranslations('incomeStatement');
  return (
    <SkeletonSection message={t('loading')} className={STATEMENT_COLUMNS}>
      <TablePanelSkeleton />
      <TablePanelSkeleton />
      <TablePanelSkeleton />
    </SkeletonSection>
  );
}
