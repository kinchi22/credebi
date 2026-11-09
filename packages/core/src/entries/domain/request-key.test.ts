import { describe, expect, it } from 'vitest';
import { domainError, err, isOk, ok, type AccountId, type EntryId, type Money } from '@repo/contracts';
import { makeEntry, type Entry, type EntryDraft } from './entry';
import { retriedEntry } from './request-key';

const CASH = '01920000-0000-7000-8000-00000000c001' as AccountId;
const EXPENSES = '01920000-0000-7000-8000-00000000c005' as AccountId;

const NAMES = new Map([
  [CASH, { id: CASH, name: 'Cash' }],
  [EXPENSES, { id: EXPENSES, name: 'Expenses' }],
]);

const KEY = 'coffee-2026-09-15';

const FIRST_POST: EntryDraft = {
  entryDate: '2026-09-15',
  title: 'Cafe',
  memo: 'Coffee',
  lines: [
    { account: EXPENSES, side: 'debit', amount: 4500 as Money },
    { account: CASH, side: 'credit', amount: 4500 as Money },
  ],
};

function posted(): Entry {
  const made = makeEntry(FIRST_POST, {
    id: '01920000-0000-7000-8000-000000000001' as EntryId,
    createdAt: new Date('2026-09-15T00:30:00.000Z'),
  }, NAMES);
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

const OTHER_CONTENT = err(
  domainError('CONFLICT', `Request key "${KEY}" was already used to post an Entry with other content.`),
);

describe('retriedEntry', () => {
  it('answers the Entry the key posted for a post of the same day, Title, memo and lines', () => {
    const entry = posted();

    expect(retriedEntry(KEY, { ...FIRST_POST }, { entry, reversed: false })).toEqual(ok(entry));
  });

  it('answers the Entry the key posted for a post differing only by whitespace around its Title and memo', () => {
    const entry = posted();

    expect(
      retriedEntry(KEY, { ...FIRST_POST, title: ' Cafe ', memo: 'Coffee\t' }, { entry, reversed: false }),
    ).toEqual(ok(entry));
  });

  it.each([
    ['another day', { entryDate: '2026-09-16' }],
    ['another Title', { title: 'Bakery' }],
    ['another memo', { memo: 'Tea' }],
    [
      'other lines',
      {
        lines: [
          { account: EXPENSES, side: 'debit', amount: 9900 as Money },
          { account: CASH, side: 'credit', amount: 9900 as Money },
        ],
      },
    ],
  ] as const)('refuses as a conflict a post with %s than the key posted', (_, change) => {
    expect(retriedEntry(KEY, { ...FIRST_POST, ...change }, { entry: posted(), reversed: false })).toEqual(
      OTHER_CONTENT,
    );
  });

  it('refuses as a conflict a post whose key posted an Entry since reversed, even with the same content', () => {
    expect(retriedEntry(KEY, FIRST_POST, { entry: posted(), reversed: true })).toEqual(
      err(
        domainError(
          'CONFLICT',
          `Request key "${KEY}" posted an Entry that has since been deleted or corrected.`,
        ),
      ),
    );
  });
});
