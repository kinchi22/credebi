import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryLineName, expectTile } from './account-type-cues';
import { BOOKS_OPEN } from './accounts';
import {
  type Account,
  DAY,
  entryOn,
  expectNamesInOrder,
  listedEntry,
  openEntryForm,
  postEntries,
  type Side,
  submitMultiLineEntry,
  TYPE_OF,
} from './entries';
import { resultFor, search } from './entry-search';
import { expectSettingsPageIn, languageChoice } from './language';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';

type PlacedLine = { readonly side: Side; readonly account: Account };

type Posted = { readonly memo: string; readonly lines: readonly PlacedLine[] };

const ONE_PER_SIDE: readonly (readonly [debit: Account, credit: Account])[] = [
  ['Cash', 'Credit card payable'],
  ['Credit card payable', 'Opening balance equity'],
  ['Opening balance equity', 'Salary'],
  ['Salary', 'Food'],
  ['Food', 'Bank deposits'],
];

const MULTI_LINE: readonly PlacedLine[] = [
  { side: 'Debit', account: 'Cash' },
  { side: 'Debit', account: 'Credit card payable' },
  { side: 'Debit', account: 'Opening balance equity' },
  { side: 'Debit', account: 'Salary' },
  { side: 'Debit', account: 'Food' },
  { side: 'Credit', account: 'Bank deposits' },
  { side: 'Credit', account: 'Credit card payable' },
  { side: 'Credit', account: 'Opening balance equity' },
  { side: 'Credit', account: 'Salary' },
  { side: 'Credit', account: 'Transportation' },
];

const LINE_AMOUNT = '100';

async function postEveryTypeOnBothSides(page: Page, tag: string): Promise<readonly Posted[]> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const memoOf = (index: number): string => `${tag} one per side ${String(index)}`;
  await postEntries(
    page,
    ONE_PER_SIDE.map(([debit, credit], index) => entryOn(DAY, memoOf(index), debit, credit, LINE_AMOUNT)),
  );
  const onePerSide = ONE_PER_SIDE.map(([debit, credit], index): Posted => ({
    memo: memoOf(index),
    lines: [
      { side: 'Debit', account: debit },
      { side: 'Credit', account: credit },
    ],
  }));

  const multiLine: Posted = { memo: `${tag} multi-line`, lines: MULTI_LINE };
  const form = await openEntryForm(page, 'Multi-line mode');
  await submitMultiLineEntry(form, {
    day: DAY,
    memo: multiLine.memo,
    lines: MULTI_LINE.map((line) => ({ ...line, amount: LINE_AMOUNT })),
  });
  await expect(listedEntry(page, multiLine.memo)).toHaveCount(1);

  return [...onePerSide, multiLine];
}

async function expectCuedLines(entry: Locator, lines: readonly PlacedLine[]): Promise<void> {
  await expect(entry).toHaveCount(1);
  const shown = entry.getByTestId('entry-line');
  await expectNamesInOrder(
    shown,
    lines.map(({ side, account }) => entryLineName(account, side)),
  );
  for (const [index, { account }] of lines.entries()) {
    await expectTile(shown.nth(index), TYPE_OF[account]);
  }
}

test('names each Entry line in the Entries list by its Account, Account type and Balance direction, for every Account type on both Sides, with a tile tinted in its type colour, in Entries of one Account per Side and in a multi-line Entry', async ({ page }) => {
  test.slow();
  const posted = await postEveryTypeOnBothSides(page, randomUUID());

  await page.goto('/entries');
  for (const { memo, lines } of posted) {
    await expectCuedLines(listedEntry(page, memo), lines);
  }
});

test('names each Entry line in Entry search by its Account, Account type and Balance direction, for every Account type on both Sides, with a tile tinted in its type colour, in Entries of one Account per Side and in a multi-line Entry', async ({ page }) => {
  test.slow();
  const tag = randomUUID();
  const posted = await postEveryTypeOnBothSides(page, tag);

  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, { memo: tag });
  for (const { memo, lines } of posted) {
    await expectCuedLines(resultFor(page, memo), lines);
  }
});

test('names each Entry line in Korean by its Account, its Account type and its Balance direction when the User reads Korean', async ({ page }) => {
  const memo = `Groceries ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [entryOn(DAY, memo, 'Food', 'Credit card payable', LINE_AMOUNT)]);

  await page.goto('/settings');
  await languageChoice(page, 'en', 'ko').check();
  await expectSettingsPageIn(page, 'ko');
  await page.goto('/entries');

  const lines = listedEntry(page, memo).getByTestId('entry-line');
  await expectNamesInOrder(lines, [
    entryLineName('Food', 'Debit', 'ko'),
    entryLineName('Credit card payable', 'Credit', 'ko'),
  ]);
});
