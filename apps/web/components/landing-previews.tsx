'use client';

import { trendLineSchema } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendChart } from './assets-and-liabilities-trend-chart';
import { type EntryDeletion } from './delete-entry';
import { type EntryFormState } from './entry-form';
import { EntryList } from './entry-list';
import { IncomeStatementTables } from './income-statement-tables';
import { sampleBooks, type SampleBooks } from './sample-books';
import { useUnfoldingEntry } from './use-unfolding-entry';

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

function UnfoldingEntries({ chart, entries }: Pick<SampleBooks, 'chart' | 'entries'>): ReactNode {
  const { list, heldOpen, reserved } = useUnfoldingEntry(entries);
  return (
    <div ref={list} style={{ minHeight: reserved }} className="flex flex-col *:flex-1">
      <EntryList
        entries={entries}
        heldOpen={heldOpen}
        controls={{ chart, titles: [], entryFormMode: 'two-line', editEntry: editNothing, deleteEntry: deleteNothing }}
      />
    </div>
  );
}

export function EntriesPreview(): ReactNode {
  const { chart, entries } = useSampleBooks();
  return <UnfoldingEntries key={useLocale()} chart={chart} entries={entries} />;
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
