import { describe, expect, it } from 'vitest';
import { type AccountId, type EntryId, type Money } from '@repo/contracts';
import { offeredSince, offeredTitles, type TitledEntry, type TitledLine } from './offered-titles';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const BANK = '01920000-0000-7000-8000-00000000c002' as AccountId;
const CAPITAL = '01920000-0000-7000-8000-00000000c003' as AccountId;
const PAYABLE = '01920000-0000-7000-8000-00000000c006' as AccountId;
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

  it('answers one object per Title, carrying the Title, the lines of its Entry and the Accounts it suggests per Side', () => {
    expect(offeredTitles([titled(1, 'Rent', at(1))])).toEqual([
      {
        title: 'Rent',
        lines: [
          { account: EXPENSES, side: 'debit', amount: 12500 },
          { account: CASH, side: 'credit', amount: 12500 },
        ],
        suggested: { debit: [EXPENSES], credit: [CASH] },
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
    ).toMatchObject([{ title: 'salary', lines: latest.lines }]);
  });

  it('carries the lines of the later id when two Entries with the Title were created at once', () => {
    const later: TitledEntry = {
      ...titled(2, 'Rent', at(1)),
      lines: [
        { account: EXPENSES, side: 'debit', amount: 700 as Money },
        { account: SALES, side: 'credit', amount: 700 as Money },
      ],
    };

    expect(offeredTitles([later, titled(1, 'Rent', at(1))])).toMatchObject([
      { title: 'Rent', lines: later.lines },
    ]);
  });
});

const debit = (account: AccountId): TitledLine => ({ account, side: 'debit', amount: 100 as Money });

const credit = (account: AccountId): TitledLine => ({ account, side: 'credit', amount: 100 as Money });

const naming = (
  id: number,
  title: string,
  createdAt: Date,
  lines: readonly TitledLine[],
): TitledEntry => ({ ...titled(id, title, createdAt), lines });

const suggestedFor = (entries: readonly TitledEntry[]): ReturnType<typeof offeredTitles>[number]['suggested'] | undefined =>
  offeredTitles(entries)[0]?.suggested;

describe('suggested accounts', () => {
  it('suggests per Side the Accounts most often named on it first, then those of the most recently created Entry', () => {
    expect(
      suggestedFor([
        naming(1, 'Groceries', at(1), [debit(CAPITAL), credit(CASH)]),
        naming(2, 'groceries', at(2), [debit(EXPENSES), credit(PAYABLE)]),
        naming(3, 'Groceries', at(3), [debit(SALES), credit(CASH)]),
        naming(4, 'groceries', at(4), [debit(EXPENSES), credit(SALES)]),
        naming(5, 'Groceries', at(5), [debit(PAYABLE), credit(CAPITAL)]),
      ]),
    ).toEqual({
      debit: [EXPENSES, PAYABLE, SALES, CAPITAL],
      credit: [CASH, CAPITAL, SALES, PAYABLE],
    });
  });

  it('suggests every Account named on a Side, ranked, leaving the cut to whoever shows them', () => {
    expect(
      suggestedFor([
        naming(1, 'Salary', at(1), [debit(CASH), credit(SALES)]),
        naming(2, 'Salary', at(2), [debit(BANK), credit(SALES)]),
        naming(3, 'Salary', at(3), [debit(EXPENSES), credit(SALES)]),
        naming(4, 'Salary', at(4), [debit(PAYABLE), credit(SALES)]),
        naming(5, 'Salary', at(5), [debit(CAPITAL), credit(SALES)]),
      ])?.debit,
    ).toEqual([CAPITAL, PAYABLE, EXPENSES, BANK, CASH]);
  });

  it('counts an Account once per Entry and Side, however many of its lines name it', () => {
    expect(
      suggestedFor([
        naming(1, 'Salary', at(1), [debit(CASH), debit(CASH), debit(CASH), credit(SALES)]),
        naming(2, 'Salary', at(2), [debit(BANK), credit(SALES)]),
        naming(3, 'Salary', at(3), [debit(BANK), credit(SALES)]),
      ])?.debit,
    ).toEqual([BANK, CASH]);
  });

  it('counts an Account named on both Sides once on each', () => {
    expect(
      suggestedFor([
        naming(1, 'Transfer', at(1), [debit(CASH), credit(CASH)]),
        naming(2, 'Transfer', at(2), [debit(BANK), credit(BANK)]),
        naming(3, 'Transfer', at(3), [debit(CASH), credit(BANK)]),
      ]),
    ).toEqual({ debit: [CASH, BANK], credit: [BANK, CASH] });
  });

  it('suggests by the Entries of the Title alone, ignoring case', () => {
    expect(
      offeredTitles([
        naming(1, 'Rent', at(1), [debit(EXPENSES), credit(BANK)]),
        naming(2, 'Salary', at(2), [debit(CASH), credit(SALES)]),
        naming(3, 'RENT', at(3), [debit(EXPENSES), credit(CASH)]),
      ]).map(({ title, suggested }) => ({ title, suggested })),
    ).toEqual([
      { title: 'RENT', suggested: { debit: [EXPENSES], credit: [CASH, BANK] } },
      { title: 'Salary', suggested: { debit: [CASH], credit: [SALES] } },
    ]);
  });

  it('ranks a tie on count and creation time by the later Entry id first', () => {
    expect(
      suggestedFor([
        naming(2, 'Rent', at(1), [debit(BANK), credit(SALES)]),
        naming(1, 'Rent', at(1), [debit(CASH), credit(SALES)]),
      ])?.debit,
    ).toEqual([BANK, CASH]);
  });

  it('ranks Accounts tied on count and named by the same Entry by Account id', () => {
    expect(
      suggestedFor([naming(1, 'Salary', at(1), [debit(EXPENSES), debit(BANK), debit(CASH), credit(SALES)])])
        ?.debit,
    ).toEqual([CASH, BANK, EXPENSES]);
  });

  it('suggests nothing on a Side no Entry of the Title names', () => {
    expect(suggestedFor([naming(1, 'Odd', at(1), [debit(CASH)])])).toEqual({
      debit: [CASH],
      credit: [],
    });
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
