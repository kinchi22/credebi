import { PANEL } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { SkeletonBlock, SkeletonField, SkeletonLine, SkeletonRow, SkeletonSection } from './skeleton';

const ROWS_WHEN_COUNT_UNKNOWN = Array.from({ length: 3 }, (_, index) => index);

export function EntriesFormSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('entryForm.title') })}
      className={`${PANEL} flex flex-col gap-3`}
    >
      <SkeletonLine className="w-32" />
      <div className="flex flex-wrap gap-3">
        <SkeletonField className="w-36" />
        <SkeletonField className="w-full wide:w-72" />
      </div>
      <SkeletonField className="w-full" />
      <SkeletonBlock className="h-control w-full" />
      <SkeletonBlock className="h-control w-full" />
      <div className="flex items-end gap-3">
        <SkeletonBlock className="h-control grow" />
        <SkeletonBlock className="h-control w-24" />
      </div>
    </SkeletonSection>
  );
}

export function EntriesListSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('entryList.title') })}
      className={`${PANEL} flex flex-col gap-2`}
    >
      {ROWS_WHEN_COUNT_UNKNOWN.map((row) => (
        <SkeletonRow key={row} />
      ))}
    </SkeletonSection>
  );
}
