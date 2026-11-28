import { PANEL } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { SETTINGS_ROW } from './control-classes';
import { SkeletonBlock, SkeletonLine, SkeletonRow, SkeletonSection } from './skeleton';

const UNKNOWN_COUNT = 3;

const COUNTED = Array.from({ length: UNKNOWN_COUNT }, (_, index) => index);

export function EntryFormModeSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('settingsPage.entryFormMode') })}
      className={`${SETTINGS_ROW} border-t`}
    >
      <SkeletonLine className="w-32" />
      <SkeletonBlock className="h-30 self-stretch wide:max-w-2xl wide:flex-1 wide:self-auto" />
    </SkeletonSection>
  );
}

export function LanguageSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('language.label') })}
      className={SETTINGS_ROW}
    >
      <SkeletonLine className="w-24" />
      <SkeletonBlock className="h-11 self-stretch wide:max-w-2xl wide:flex-1 wide:self-auto" />
    </SkeletonSection>
  );
}

export function AccountsSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('accountsSection.title') })}
      className="flex flex-col gap-2 border-b border-border py-5"
    >
      <div className="flex min-h-control items-center justify-between gap-3">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="w-32" />
      </div>
      <div className={`${PANEL} flex flex-col gap-2`}>
        {COUNTED.map((row) => (
          <SkeletonRow key={row} />
        ))}
      </div>
    </SkeletonSection>
  );
}

export function ConnectionsSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('connectionsSection.title') })}
      className="flex flex-col gap-3 border-b border-border py-5"
    >
      <div className="flex min-h-control items-center justify-between gap-2">
        <SkeletonLine className="w-28" />
        <SkeletonBlock className="h-control w-32" />
      </div>
      <div className={`${PANEL} flex flex-col gap-2`}>
        {COUNTED.map((row) => (
          <SkeletonRow key={row} />
        ))}
      </div>
    </SkeletonSection>
  );
}
