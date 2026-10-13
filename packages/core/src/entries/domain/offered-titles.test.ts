import { describe, expect, it } from 'vitest';
import { type AccountId, type EntryId, type Money } from '@repo/contracts';
import { offeredSince, offeredTitles, type TitledEntry } from './offered-titles';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;
const SALES = '01920000-0000-7000-8000-00000000c004' as AccountId;

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 4, 9, minute));

const titled = (id: number, title: string, createdAt: Date): TitledEntry => ({
  id: `01920000-0000-7000-8000-${id.toString().padStart(12, '0')}` as EntryId,
  title,
  createdAt,
  lines: [
    { account: EXPENSES, side: 'debit', amount: 12500 as Money },
    { account: CASH, side: 'credit', amount: 12500 as Money },
  ],
});

const titlesOf = (entries: readonly TitledEntry[]): readonly string[] =>
  offeredTitles(entries).map(({ title }) => title);

describe('offeredTitles', () => {
  it('offers each Title once, the most recently created first whatever order the Entries come in', () => {
    expect(
      titlesOf([titled(1, 'Salary', at(2)), titled(2, 'Rent', at(4)), titled(3, 'Starbucks', at(1))]),
    ).toEqual(['Rent', 'Salary', 'Starbucks']);
  });

  it('merges Titles differing only in case, spelled and placed as on the most recently created Entry', () => {
    expect(
      titlesOf([
        titled(1, 'Starbucks', at(1)),
        titled(2, 'Salary', at(2)),
        titled(3, 'starbucks', at(3)),
        titled(4, 'SALARY', at(0)),
      ]),
    ).toEqual(['starbucks', 'Salary']);
  });

  it('breaks a tie on creation time by the later id first', () => {
    expect(titlesOf([titled(1, 'First', at(1)), titled(2, 'Second', at(1))])).toEqual([
      'Second',
      'First',
    ]);
    expect(titlesOf([titled(2, 'second', at(1)), titled(1, 'Second', at(1))])).toEqual(['second']);
  });

  it('offers nothing for an Entry with no Title', () => {
    expect(titlesOf([titled(1, '', at(1)), titled(2, 'Rent', at(2))])).toEqual(['Rent']);
  });

  it('offers nothing when no Entry carries a Title', () => {
    expect(offeredTitles([])).toEqual([]);
  });

  it('answers one object per Title, carrying the Title and the lines of its Entry', () => {
    expect(offeredTitles([titled(1, 'Rent', at(1))])).toEqual([
      {
        title: 'Rent',
        lines: [
          { account: EXPENSES, side: 'debit', amount: 12500 },
          { account: CASH, side: 'credit', amount: 12500 },
        ],
      },
    ]);
  });

  it('carries the lines of the most recently created Entry with the Title, ignoring case, in their stored order', () => {
    const latest: TitledEntry = {
      ...titled(2, 'salary', at(3)),
      lines: [
        { account: SALES, side: 'credit', amount: 9000 as Money },
        { account: CASH, side: 'debit', amount: 6000 as Money },
        { account: EXPENSES, side: 'debit', amount: 3000 as Money },
      ],
    };

    expect(
      offeredTitles([titled(1, 'Salary', at(1)), latest, titled(3, 'SALARY', at(2))]),
    ).toEqual([{ title: 'salary', lines: latest.lines }]);
  });

  it('carries the lines of the later id when two Entries with the Title were created at once', () => {
    const later: TitledEntry = {
      ...titled(2, 'Rent', at(1)),
      lines: [
        { account: EXPENSES, side: 'debit', amount: 700 as Money },
        { account: SALES, side: 'credit', amount: 700 as Money },
      ],
    };

    expect(offeredTitles([later, titled(1, 'Rent', at(1))])).toEqual([
      { title: 'Rent', lines: later.lines },
    ]);
  });
});

describe('offeredSince', () => {
  it('starts the window two years before now, to the instant', () => {
    expect(offeredSince(new Date('2026-10-13T08:30:15.250Z'))).toEqual(
      new Date('2024-10-13T08:30:15.250Z'),
    );
  });

  it('leaves the instant it is given as it was', () => {
    const now = new Date('2026-10-13T08:30:15.250Z');

    offeredSince(now);

    expect(now).toEqual(new Date('2026-10-13T08:30:15.250Z'));
  });
});
