import { describe, expect, it } from 'vitest';
import { isOk, type EntryId, type Money } from '@repo/contracts';
import { changesEntry } from './correction';
import { makeEntry, type Entry, type EntryDraft } from './entry';

const AS_POSTED: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Rent',
  lines: [
    { account: 'expense', side: 'debit', amount: 70000 as Money },
    { account: 'cash', side: 'credit', amount: 40000 as Money },
    { account: 'payable', side: 'credit', amount: 30000 as Money },
  ],
};

function posted(): Entry {
  const made = makeEntry(AS_POSTED, {
    id: '01920000-0000-7000-8000-000000000001' as EntryId,
    createdAt: new Date('2026-09-15T00:30:00.000Z'),
  });
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

const withLine = (
  index: number,
  line: Partial<EntryDraft['lines'][number]>,
): EntryDraft['lines'] =>
  AS_POSTED.lines.map((current, at) => (at === index ? { ...current, ...line } : current));

describe('changesEntry', () => {
  it('finds no change in a draft of the same day, memo and lines in the same order', () => {
    expect(changesEntry({ ...AS_POSTED, lines: [...AS_POSTED.lines] }, posted())).toBe(false);
  });

  it('finds no change in a memo that differs only by surrounding whitespace', () => {
    expect(changesEntry({ ...AS_POSTED, memo: '  Rent \t' }, posted())).toBe(false);
  });

  it('finds a change in the day', () => {
    expect(changesEntry({ ...AS_POSTED, entryDate: '2026-09-16' }, posted())).toBe(true);
  });

  it('finds a change in the memo, its case included', () => {
    expect(changesEntry({ ...AS_POSTED, memo: 'Rent, June' }, posted())).toBe(true);
    expect(changesEntry({ ...AS_POSTED, memo: 'rent' }, posted())).toBe(true);
  });

  it("finds a change in a line's Account, Side or amount", () => {
    for (const lines of [
      withLine(1, { account: 'payable' }),
      withLine(2, { side: 'debit' }),
      withLine(2, { amount: 30001 as Money }),
    ]) {
      expect(changesEntry({ ...AS_POSTED, lines }, posted())).toBe(true);
    }
  });

  it('finds a change in the same lines in another order', () => {
    const [debit, cash, payable] = AS_POSTED.lines;
    const reordered = [debit, payable, cash].filter((line) => line !== undefined);

    expect(changesEntry({ ...AS_POSTED, lines: reordered }, posted())).toBe(true);
  });

  it('finds a change in a line added or a line taken away', () => {
    const added = [
      ...AS_POSTED.lines,
      { account: 'cash', side: 'credit', amount: 1 as Money } as const,
    ];

    expect(changesEntry({ ...AS_POSTED, lines: added }, posted())).toBe(true);
    expect(changesEntry({ ...AS_POSTED, lines: AS_POSTED.lines.slice(0, 2) }, posted())).toBe(
      true,
    );
  });
});
