import { PANEL, PANEL_BLEED } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { DENSE_FIELD, ENTRY_FORM_FRAME, ENTRY_FORM_HEADING, ENTRY_LIST_ROW } from './control-classes';
import { SkeletonBlock, SkeletonField, SkeletonLine, SkeletonRows, SkeletonSection } from './skeleton';

export function EntriesFormSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('entryForm.title') })}
      className={`${PANEL} ${ENTRY_FORM_FRAME}`}
    >
      <SkeletonLine className="w-32" />
      <div className={ENTRY_FORM_HEADING}>
        <div className={DENSE_FIELD}>
          <SkeletonField className="w-36" />
        </div>
        <div className="min-w-0 grow">
          <SkeletonField className="w-full" />
        </div>
        <div className="basis-full wide:col-span-full">
          <SkeletonField className="w-full" />
        </div>
      </div>
      <SkeletonBlock className="h-control w-full" />
      <SkeletonBlock className="h-control w-full" />
      <div className="flex items-end gap-3">
        <SkeletonBlock className="h-control grow" />
        <SkeletonBlock className="h-control w-24" />
      </div>
    </SkeletonSection>
  );
}

export function EntryRowSkeleton(): ReactNode {
  return (
    <div className={`${PANEL_BLEED} flex flex-col gap-2 ${ENTRY_LIST_ROW}`}>
      <div className="flex items-center justify-between gap-3 pb-2">
        <SkeletonLine className="w-2/5" />
        <SkeletonLine className="w-1/5" />
      </div>
      <SkeletonLine className="w-3/5" />
      <SkeletonLine className="w-2/5" />
    </div>
  );
}

export function EntriesListSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('entryList.title') })}
      className={PANEL}
    >
      <SkeletonRows row={EntryRowSkeleton} />
    </SkeletonSection>
  );
}
