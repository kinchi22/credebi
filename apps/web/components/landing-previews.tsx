'use client';

import { trendLineSchema } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendChart } from './assets-and-liabilities-trend-chart';
import { type EntryDeletion } from './delete-entry';
import { type EntryFormState } from './entry-form';
import { EntryList } from './entry-list';
import { heldOpenAt } from './entry-unfold';
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

export function EntriesPreview(): ReactNode {
  const { chart, entries } = useSampleBooks();
  const { list, heldOpen } = useUnfoldingEntry(entries);
  const controls = { chart, titles: [], entryFormMode: 'two-line', editEntry: editNothing, deleteEntry: deleteNothing } as const;
  return (
    <div className="grid *:col-start-1 *:row-start-1">
      <div inert aria-hidden className="invisible">
        <EntryList entries={entries} controls={controls} heldOpen={heldOpenAt(entries, true)} standIn />
      </div>
      <div ref={list} className="flex flex-col *:flex-1">
        <EntryList entries={entries} controls={controls} heldOpen={heldOpen} />
      </div>
    </div>
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
