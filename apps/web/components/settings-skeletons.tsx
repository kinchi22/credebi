import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import {
  CONNECTIONS_SECTION,
  FIRST_SETTINGS_ROW,
  SETTINGS_ROW,
  SETTINGS_SECTION,
} from './control-classes';
import { SkeletonBlock, SkeletonLine, SkeletonRowsPanel, SkeletonSection } from './skeleton';

export function EntryFormModeSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('settingsPage.entryFormMode') })}
      className={FIRST_SETTINGS_ROW}
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
      className={SETTINGS_SECTION}
    >
      <div className="flex min-h-control items-center justify-between gap-3">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="w-32" />
      </div>
      <SkeletonRowsPanel />
    </SkeletonSection>
  );
}

export function ConnectionsSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('connectionsSection.title') })}
      className={CONNECTIONS_SECTION}
    >
      <div className="flex min-h-control items-center justify-between gap-2">
        <SkeletonLine className="w-28" />
        <SkeletonBlock className="h-control w-32" />
      </div>
      <SkeletonRowsPanel />
    </SkeletonSection>
  );
}
