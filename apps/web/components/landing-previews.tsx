'use client';

import { trendLineSchema } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendChart } from './assets-and-liabilities-trend-chart';
import { type EntryDeletion } from './delete-entry';
import { type EntryFormState } from './entry-form';
import { EntryList } from './entry-list';
import { IncomeStatementTables } from './income-statement-tables';
import { sampleBooks, type SampleBooks } from './sample-books';

const keepNothing = (): Promise<void> => Promise.resolve();

const editNothing = (_id: string, previous: EntryFormState): Promise<EntryFormState> => Promise.resolve(previous);

const deleteNothing = (): Promise<EntryDeletion> => Promise.resolve({ outcome: 'deleted' });

function useSampleBooks(): SampleBooks {
  const startingChart = useTranslations('startingChart');
  const titles = useTranslations('landingPage.sampleTitles');
  return sampleBooks({
    name: (node) => startingChart(`${node}.name`),
    title: (title) => titles(title),
  });
}

export function EntriesPreview(): ReactNode {
  const { chart, entries } = useSampleBooks();
  return (
    <EntryList
      entries={entries}
      controls={{ chart, titles: [], entryFormMode: 'two-line', editEntry: editNothing, deleteEntry: deleteNothing }}
    />
  );
}

export function TrendPreview(): ReactNode {
  const { months } = useSampleBooks();
  return (
    <div className={`${PANEL} min-w-0`}>
      <AssetsAndLiabilitiesTrendChart months={months} lines={{ shown: trendLineSchema.options, keep: keepNothing }} />
    </div>
  );
}

export function IncomeStatementPreview(): ReactNode {
  const { statement, period } = useSampleBooks();
  return <IncomeStatementTables statement={statement} period={period} keep={keepNothing} />;
}
