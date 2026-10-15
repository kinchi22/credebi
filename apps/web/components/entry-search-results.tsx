import { useTranslations } from 'next-intl';
import { type PostedEntry } from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, type ReactNode } from 'react';
import { type EntrySearchAnswer } from '../server/entry-search';
import { EntryList, type EntryControls } from './entry-list';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

type ResultsRegionProps = {
  readonly busy: boolean;
  readonly children: ReactNode;
};

function ResultsRegion({ busy, children }: ResultsRegionProps): ReactNode {
  const t = useTranslations();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} aria-busy={busy} className="flex flex-col gap-2">
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
    <ResultsRegion busy={false}>
      {entries.length === 0 ? (
        <p className={MUTED_TEXT}>{t('entrySearch.nothingMatched')}</p>
      ) : (
        <EntryList entries={entries} controls={controls} />
      )}
    </ResultsRegion>
  );
}

export function EntrySearchPending(): ReactNode {
  const t = useTranslations();
  return (
    <ResultsRegion busy>
      <p role="status" className={MUTED_TEXT}>
        {t('entrySearch.searching')}
      </p>
    </ResultsRegion>
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
