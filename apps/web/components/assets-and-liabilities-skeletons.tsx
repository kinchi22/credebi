import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { SkeletonLine, SkeletonRowsPanel, SkeletonSection } from './skeleton';
import { PLACEMENT, STATEMENT_COLUMNS } from './statement-tables';

const HEADING = <SkeletonLine className="w-1/3" />;

export function AssetsAndLiabilitiesSkeleton(): ReactNode {
  const t = useTranslations();
  const { left, right, totals } = PLACEMENT.left;
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('assetsAndLiabilitiesPage.title') })}
      className={STATEMENT_COLUMNS}
    >
      <SkeletonRowsPanel heading={HEADING} className={left} />
      <SkeletonRowsPanel heading={HEADING} className={right} />
      <SkeletonRowsPanel heading={HEADING} className={totals} />
    </SkeletonSection>
  );
}
