import { useTranslations } from 'next-intl';
import { type PostedEntry } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { type EntrySearchAnswer } from '../server/entry-search';
import { EntryRowSkeleton } from './entries-skeletons';
import { EntryList, type EntryControls } from './entry-list';
import { SkeletonLine, SkeletonRows, SkeletonSection } from './skeleton';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

function ResultsRegion({ children }: { readonly children: ReactNode }): ReactNode {
  const t = useTranslations();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2
        id={titleId}
        className={`${typeClasses.label} text-text-muted`}
      >
        {t('entrySearch.results')}
      </h2>
      {children}
    </section>
  );
}

export type EntrySearchResultsProps = {
  readonly entries: readonly PostedEntry[];
  readonly controls: EntryControls;
};

export function EntrySearchResults({ entries, controls }: EntrySearchResultsProps): ReactNode {
  const t = useTranslations();
  return (
    <ResultsRegion>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{t('entrySearch.nothingMatched')}</p>
      ) : (
        <EntryList entries={entries} controls={controls} />
      )}
    </ResultsRegion>
  );
}

export function EntrySearchSkeleton(): ReactNode {
  const t = useTranslations();
  return (
    <SkeletonSection
      message={t('sectionState.loading', { section: t('entrySearch.results') })}
      className="flex flex-col gap-2"
    >
      <SkeletonLine className="w-16" />
      <div className={PANEL}>
        <SkeletonRows row={EntryRowSkeleton} />
      </div>
    </SkeletonSection>
  );
}

export type EntrySearchOutcomeProps = {
  readonly answer: EntrySearchAnswer;
  readonly controls: EntryControls;
};

export function EntrySearchOutcome({ answer, controls }: EntrySearchOutcomeProps): ReactNode {
  const t = useTranslations();
  return answer.outcome === 'refused' ? (
    <p role="alert" className={DANGER_TEXT}>
      {t('entrySearch.refused')}
    </p>
  ) : (
    <EntrySearchResults entries={answer.entries} controls={controls} />
  );
}
