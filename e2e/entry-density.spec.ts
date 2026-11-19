import { expect, test, type Locator, type Page, type ViewportSize } from '@playwright/test';
import { boxOf } from './accounts';
import {
  type Account,
  DAY,
  type Line,
  nameOf,
  type Side,
  type TwoLineEntry,
  deleteButton,
  editDialog,
  entries,
  type Heading,
  listedEntry,
  openDelete,
  openEditEntry,
  openEntryForm,
  postEntries,
  submitMultiLineEntry,
} from './entries';
import {
  chevron,
  entryMemo,
  expectCompact,
  expectDetailed,
  expectExpanded,
  expectNoChevron,
  expectOneRowHeader,
  expectThreeRowHeader,
  expectTotalAloneOnItsRow,
  NARROW_WIDE,
  nameIn,
  recordViewTransitions,
  selectText,
  type ShownLine,
  viewTransitionAnimations,
  waitFrames,
} from './entry-density';
import { resultFor, search } from './entry-search';
import { ENTRY_SEARCH_PATH } from './routes';
import { BOOKS_OPEN, signIn } from './session';
import { expectWithinPhone, PHONE, WIDE, WIDE_BELOW_SPLIT } from './viewport';

type Posted = Heading & { readonly lines: readonly Line[] };

type Titled = Posted & { readonly title: string };

const line = (side: Side, account: Account, amount: string): Line => ({ side, account, amount });

const PAYROLL: Titled = {
  day: DAY,
  title: 'Payroll',
  memo: 'September pay and a lunch',
  lines: [
    line('Debit', 'Cash', '10000'),
    line('Debit', 'Food', '2500'),
    line('Credit', 'Salary', '12000'),
    line('Credit', 'Opening balance equity', '500'),
  ],
};

const SPLIT_BILL: Titled = {
  day: DAY,
  title: 'Groceries',
  memo: 'Paid partly by card',
  lines: [line('Debit', 'Food', '12500'), line('Credit', 'Cash', '12000'), line('Credit', 'Credit card payable', '500')],
};

const LUNCH: Titled = {
  day: DAY,
  title: 'Lunch',
  memo: 'Noodles near the office',
  lines: [line('Debit', 'Food', '3580'), line('Credit', 'Cash', '3580')],
};

const UNTITLED: Posted = {
  day: DAY,
  memo: 'Bus fare home',
  lines: [line('Debit', 'Transportation', '1200'), line('Credit', 'Cash', '1200')],
};

const NO_MEMO: Titled = {
  day: DAY,
  title: 'Espresso',
  memo: '',
  lines: [line('Debit', 'Food', '3580'), line('Credit', 'Cash', '3580')],
};

const RENT: Titled = {
  day: DAY,
  title: 'Rent',
  memo: 'Rent for the flat by the river for the whole of the coming year, paid in one transfer so that the landlord holds the deposit until the lease ends',
  lines: [line('Debit', 'Other living expenses', '9999999999'), line('Credit', 'Bank deposits', '9999999999')],
};

const shownLines = (posted: Posted): readonly ShownLine[] =>
  posted.lines.map(({ side, account, amount }) => ({
    side,
    name: nameOf(account),
    amount: Number(amount).toLocaleString('en-US'),
  }));

function asTwoLine(posted: Posted): readonly TwoLineEntry[] {
  const [debit, credit, ...more] = posted.lines;
  if (debit === undefined || credit === undefined || more.length > 0) return [];
  return [{ ...posted, debitAccount: debit.account, creditAccount: credit.account, amount: debit.amount }];
}

async function post(page: Page, posted: readonly Posted[]): Promise<void> {
  await postEntries(page, posted.flatMap(asTwoLine));
  for (const entry of posted.filter((each) => asTwoLine(each).length === 0)) {
    const form = await openEntryForm(page, 'Multi-line mode');
    await submitMultiLineEntry(form, entry);
    await expect(listedEntry(page, entry.memo)).toHaveCount(1);
  }
}

async function openEntriesWith(page: Page, posted: readonly Posted[], width: ViewportSize = PHONE): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await post(page, posted);
  await page.setViewportSize(width);
  await page.goto('/entries');
}

const listed = (page: Page, posted: Posted): Locator =>
  listedEntry(page, posted.memo === '' ? (posted.title ?? '') : posted.memo);

const firstLineName = (entry: Locator, posted: Posted): Locator => {
  const [first] = shownLines(posted);
  if (first === undefined) throw new Error('an Entry has lines');
  return nameIn(entry, first);
};

test('lays an Entry out at 390px in three header rows: the date with Edit and Delete, the Title with the Entry total, then the memo across the full width', async ({ page }) => {
  await openEntriesWith(page, [RENT]);

  const entry = listed(page, RENT);
  await expectThreeRowHeader(entry, RENT);
  await expectWithinPhone(page, entry);
});

test('puts the Entry total alone on the Title row at the right at 390px when an Entry has no Title, and leaves out the memo row when it has no memo', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [UNTITLED, NO_MEMO, LUNCH]);

  await expectTotalAloneOnItsRow(listed(page, UNTITLED), UNTITLED);
  const withoutMemo = await boxOf(listed(page, NO_MEMO), 'the Entry with no memo');
  const withMemo = await boxOf(listed(page, LUNCH), 'the Entry with a memo');
  const memo = await boxOf(entryMemo(listed(page, LUNCH), LUNCH), 'the memo');
  expect(withoutMemo.height, 'an Entry with no memo has no memo row').toBeLessThan(withMemo.height - memo.height / 2);
});

test('shows Debit and Credit side by side at 390px, each compact line with its tile, name and arrow and its amount told only to assistive technology, keeping the Debit and Credit column headers', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, LUNCH]);

  for (const posted of [PAYROLL, LUNCH]) {
    await expectCompact(listed(page, posted), shownLines(posted));
    await expectWithinPhone(page, listed(page, posted));
  }
  for (const side of ['Debit', 'Credit'] as const) {
    await expect(entries(page).getByRole('columnheader', { name: side, exact: true })).toHaveCount(1);
  }
});

test('puts a collapsed chevron at 390px only on an Entry with more than one line on a Side', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, SPLIT_BILL, LUNCH]);

  await expectExpanded(listed(page, PAYROLL), PAYROLL, false);
  await expectExpanded(listed(page, SPLIT_BILL), SPLIT_BILL, false);
  await expectNoChevron(listed(page, LUNCH));
});

test('expands an Entry at 390px by its chevron, stacking its lines under their Side names with their amounts, and collapses it by the chevron again', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listed(page, PAYROLL);

  await chevron(entry, PAYROLL).click();
  await expectExpanded(entry, PAYROLL, true);
  await expectDetailed(entry, shownLines(PAYROLL), 'stacked');
  await expectWithinPhone(page, entry);

  await chevron(entry, PAYROLL).click();
  await expectExpanded(entry, PAYROLL, false);
  await expectCompact(entry, shownLines(PAYROLL));
});

test('expands and collapses an Entry at 390px by a click anywhere on its body', async ({ page }) => {
  await openEntriesWith(page, [SPLIT_BILL]);
  const entry = listed(page, SPLIT_BILL);

  await firstLineName(entry, SPLIT_BILL).click();
  await expectExpanded(entry, SPLIT_BILL, true);
  await expectDetailed(entry, shownLines(SPLIT_BILL), 'stacked');

  await entryMemo(entry, SPLIT_BILL).click();
  await expectExpanded(entry, SPLIT_BILL, false);
  await expectCompact(entry, shownLines(SPLIT_BILL));
});

test('expands and collapses an Entry at 390px by Enter and Space on its chevron', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listed(page, PAYROLL);

  await chevron(entry, PAYROLL).focus();
  await page.keyboard.press('Enter');
  await expectExpanded(entry, PAYROLL, true);
  await expectDetailed(entry, shownLines(PAYROLL), 'stacked');

  await page.keyboard.press('Space');
  await expectExpanded(entry, PAYROLL, false);
  await expectCompact(entry, shownLines(PAYROLL));
});

test('never toggles an Entry at 390px for Edit, Delete, a click in their dialogs, or a text selection', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listed(page, PAYROLL);

  const edit = await openEditEntry(entry);
  await edit.getByRole('heading', { name: 'Edit entry', exact: true }).click();
  await edit.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editDialog(page)).toBeHidden();
  await expectExpanded(entry, PAYROLL, false);

  const deletion = await openDelete(entry);
  await deletion.getByRole('heading', { name: 'Delete entry', exact: true }).click();
  await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(deletion).toBeHidden();
  await expect(deleteButton(entry)).toBeVisible();
  await expectExpanded(entry, PAYROLL, false);

  await selectText(page, entryMemo(entry, PAYROLL));
  await expectExpanded(entry, PAYROLL, false);
  await expectCompact(entry, shownLines(PAYROLL));
});

test('does not expand an Entry of one line per Side at 390px when its body is clicked', async ({ page }) => {
  await openEntriesWith(page, [LUNCH]);
  const entry = listed(page, LUNCH);

  await firstLineName(entry, LUNCH).click();
  await entryMemo(entry, LUNCH).click();

  await expectNoChevron(entry);
  await expectCompact(entry, shownLines(LUNCH));
});

test('keeps several Entries expanded at once at 390px, and starts every Entry collapsed again on a reload', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, SPLIT_BILL]);

  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await chevron(listed(page, posted), posted).click();
  }
  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await expectExpanded(listed(page, posted), posted, true);
    await expectDetailed(listed(page, posted), shownLines(posted), 'stacked');
  }

  await page.reload();
  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await expectExpanded(listed(page, posted), posted, false);
    await expectCompact(listed(page, posted), shownLines(posted));
  }
});

test('keeps the compact layout and the chevron at 800px, where the list beside the Sidebar is under 40rem', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, LUNCH], NARROW_WIDE);

  await expectCompact(listed(page, PAYROLL), shownLines(PAYROLL));
  await expectCompact(listed(page, LUNCH), shownLines(LUNCH));
  await expectNoChevron(listed(page, LUNCH));

  await chevron(listed(page, PAYROLL), PAYROLL).click();
  await expectExpanded(listed(page, PAYROLL), PAYROLL, true);
  await expectDetailed(listed(page, PAYROLL), shownLines(PAYROLL), 'stacked');
});

for (const width of [WIDE_BELOW_SPLIT, WIDE]) {
  test(`shows every Entry at ${String(width.width)}px on a one-row header with no chevron, its lines under their Side names with their amounts, and keeps a long memo and a large amount clear of the actions`, async ({ page }) => {
    test.slow();
    await openEntriesWith(page, [PAYROLL, LUNCH, RENT], width);

    for (const posted of [PAYROLL, LUNCH, RENT]) {
      const entry = listed(page, posted);
      await expectNoChevron(entry);
      await expectOneRowHeader(entry, posted);
      await expectDetailed(entry, shownLines(posted), 'side by side');
    }
  });
}

test('runs View Transition animations right after an Entry expands at 390px', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  await recordViewTransitions(page);

  await chevron(listed(page, PAYROLL), PAYROLL).click();

  await expect.poll(() => viewTransitionAnimations(page), { timeout: 2000 }).toBeGreaterThan(0);
  await expectExpanded(listed(page, PAYROLL), PAYROLL, true);
});

test('expands an Entry at 390px at once, with no View Transition animation, when the User prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEntriesWith(page, [PAYROLL]);
  await recordViewTransitions(page);

  await chevron(listed(page, PAYROLL), PAYROLL).click();

  await expectExpanded(listed(page, PAYROLL), PAYROLL, true);
  await waitFrames(page, 30);
  expect(await viewTransitionAnimations(page)).toBe(0);
  await expectDetailed(listed(page, PAYROLL), shownLines(PAYROLL), 'stacked');
});

test('shows the results of Entry search at 390px compact, expands one by its chevron, and starts a new search with every result collapsed', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, LUNCH]);
  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, {});
  const result = resultFor(page, PAYROLL.memo);

  await expectCompact(result, shownLines(PAYROLL));
  await expectCompact(resultFor(page, LUNCH.memo), shownLines(LUNCH));
  await expectNoChevron(resultFor(page, LUNCH.memo));

  await chevron(result, PAYROLL).click();
  await expectExpanded(result, PAYROLL, true);
  await expectDetailed(result, shownLines(PAYROLL), 'stacked');

  await search(page, { memo: PAYROLL.memo });
  await expectExpanded(result, PAYROLL, false);
  await expectCompact(result, shownLines(PAYROLL));
});
