import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryLineName, expectNameCued, expectOnOneRow, typeTile } from './account-type-cues';
import { BOOKS_OPEN } from './accounts';
import {
  type Account,
  DAY,
  entryOn,
  expectNamesInOrder,
  type Line,
  listedEntry,
  nameOf,
  openEntryForm,
  postEntries,
  SIDES,
  submitMultiLineEntry,
} from './entries';
import { resultFor, search } from './entry-search';
import { expectSettingsPageIn, languageChoice } from './language';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';

type Posted = { readonly memo: string; readonly lines: readonly Line[] };

const LINE_AMOUNT = '100';

const ONE_PER_SIDE: readonly (readonly [debit: Account, credit: Account])[] = [
  ['Cash', 'Credit card payable'],
  ['Credit card payable', 'Opening balance equity'],
  ['Opening balance equity', 'Salary'],
  ['Salary', 'Food'],
  ['Food', 'Bank deposits'],
];

const MULTI_LINE: readonly Line[] = (
  [
    ['Debit', 'Cash'],
    ['Debit', 'Credit card payable'],
    ['Debit', 'Opening balance equity'],
    ['Debit', 'Salary'],
    ['Debit', 'Food'],
    ['Credit', 'Bank deposits'],
    ['Credit', 'Credit card payable'],
    ['Credit', 'Opening balance equity'],
    ['Credit', 'Salary'],
    ['Credit', 'Transportation'],
  ] as const
).map(([side, account]) => ({ side, account, amount: LINE_AMOUNT }));

async function postOnePerSideEntries(page: Page, tag: string): Promise<readonly Posted[]> {
  const memoOf = (index: number): string => `${tag} one per side ${String(index)}`;
  await postEntries(
    page,
    ONE_PER_SIDE.map(([debit, credit], index) => entryOn(DAY, memoOf(index), debit, credit, LINE_AMOUNT)),
  );
  return ONE_PER_SIDE.map(([debit, credit], index): Posted => ({
    memo: memoOf(index),
    lines: [
      { side: 'Debit', account: debit, amount: LINE_AMOUNT },
      { side: 'Credit', account: credit, amount: LINE_AMOUNT },
    ],
  }));
}

async function postMultiLineEntry(page: Page, tag: string): Promise<Posted> {
  const posted: Posted = { memo: `${tag} multi-line`, lines: MULTI_LINE };
  const form = await openEntryForm(page, 'Multi-line mode');
  await submitMultiLineEntry(form, { day: DAY, memo: posted.memo, lines: MULTI_LINE });
  await expect(listedEntry(page, posted.memo)).toHaveCount(1);
  return posted;
}

async function postEveryTypeOnBothSides(page: Page, tag: string): Promise<readonly Posted[]> {
  return [...(await postOnePerSideEntries(page, tag)), await postMultiLineEntry(page, tag)];
}

async function expectCuedLines(entry: Locator, lines: readonly Line[]): Promise<void> {
  await expect(entry).toHaveCount(1);
  const shown = entry.getByTestId('entry-line');
  await expectNamesInOrder(
    shown,
    lines.map(({ side, account }) => entryLineName(nameOf(account), side)),
  );
  for (const [index, { account }] of lines.entries()) {
    await expectNameCued(shown.nth(index), nameOf(account));
  }
}

test('names each Entry line in the Entries list by its Account, Account type and Balance direction, for every Account type on both Sides, leading its name with a tile tinted in its type colour and following it with an arrow, in Entries of one Account per Side and in a multi-line Entry', async ({ page }) => {
  test.slow();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const posted = await postEveryTypeOnBothSides(page, randomUUID());

  await page.goto('/entries');
  for (const { memo, lines } of posted) {
    await expectCuedLines(listedEntry(page, memo), lines);
  }
});

test('names each Entry line in Entry search by its Account, Account type and Balance direction, for every Account type on both Sides, leading its name with a tile tinted in its type colour and following it with an arrow, in Entries of one Account per Side and in a multi-line Entry', async ({ page }) => {
  test.slow();
  const tag = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const posted = await postEveryTypeOnBothSides(page, tag);

  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, { memo: tag });
  for (const { memo, lines } of posted) {
    await expectCuedLines(resultFor(page, memo), lines);
  }
});

test("shows each Side's tile beside the Side's name in the Entries list, in an Entry of one Account per Side", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const [posted] = await postOnePerSideEntries(page, randomUUID());
  if (posted === undefined) throw new Error('no Entry was posted');

  await page.goto('/entries');
  const entry = listedEntry(page, posted.memo);
  await expectCuedLines(entry, posted.lines);
  const lines = entry.getByTestId('entry-line');
  for (const [index, side] of SIDES.entries()) {
    const sideName = entry.getByText(side, { exact: true }).filter({ visible: true }).first();
    await expectOnOneRow(sideName, typeTile(lines.nth(index)).first(), `the ${side} name and its tile`);
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
