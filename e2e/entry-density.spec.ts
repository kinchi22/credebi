import { expect, test, type Locator, type Page, type ViewportSize } from '@playwright/test';
import { expectOnOneLine } from './account-type-cues';
import { boxOf } from './accounts';
import {
  DAY,
  deleteButton,
  editDialog,
  entries,
  listedHeading,
  type MultiLineEntry,
  openDelete,
  openEditEntry,
} from './entries';
import {
  chevron,
  entryMemo,
  expectChevronNamesAnAction,
  expectCompact,
  expectDetailed,
  expectExpanded,
  expectNoChevron,
  expectOneRowHeader,
  expectThreeRowHeader,
  expectTotalAloneOnItsRow,
  line,
  lineOf,
  type LongKoreanNames,
  nameIn,
  post,
  postLongKoreanNames,
  recordViewTransitions,
  selectText,
  type ShownLine,
  shownLines,
  tabToChevronPassingOver,
  type Titled,
  viewTransitionAnimations,
} from './entry-density';
import { resultFor, search } from './entry-search';
import { ENTRY_SEARCH_PATH } from './routes';
import { BOOKS_OPEN, signIn } from './session';
import { expectWithinPhone, PHONE, waitFrames, WIDE, WIDE_BELOW_SPLIT, WIDE_BESIDE_SIDEBAR } from './viewport';

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

const TAXI: MultiLineEntry = {
  day: DAY,
  memo: 'Taxi home and a tip',
  lines: [line('Debit', 'Transportation', '2000'), line('Credit', 'Cash', '1500'), line('Credit', 'Credit card payable', '500')],
};

const LUNCH: Titled = {
  day: DAY,
  title: 'Lunch',
  memo: 'Noodles near the office',
  lines: [line('Debit', 'Food', '3580'), line('Credit', 'Cash', '3580')],
};

const UNTITLED: MultiLineEntry = {
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

async function openEntriesWith(page: Page, posted: readonly MultiLineEntry[], width: ViewportSize = PHONE): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await post(page, posted);
  await page.setViewportSize(width);
  await page.goto('/entries');
}

const firstLineName = (entry: Locator, posted: MultiLineEntry): Locator => {
  const [first] = shownLines(posted);
  if (first === undefined) throw new Error('an Entry has lines');
  return nameIn(entry, first);
};

test('lays an Entry out at 390px in three header rows: the date with Edit and Delete, the Title with the Entry total, then the memo across the full width', async ({ page }) => {
  await openEntriesWith(page, [RENT]);

  const entry = listedHeading(page, RENT);
  await expectThreeRowHeader(entry, RENT);
  await expectWithinPhone(page, entry);
});

test('puts the Entry total alone on the Title row at the right at 390px when an Entry has no Title, and leaves out the memo row when it has no memo', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [UNTITLED, NO_MEMO, LUNCH]);

  await expectTotalAloneOnItsRow(listedHeading(page, UNTITLED), UNTITLED);
  const withoutMemo = await boxOf(listedHeading(page, NO_MEMO), 'the Entry with no memo');
  const withMemo = await boxOf(listedHeading(page, LUNCH), 'the Entry with a memo');
  const memo = await boxOf(entryMemo(listedHeading(page, LUNCH), LUNCH), 'the memo');
  expect(withoutMemo.height, 'an Entry with no memo has no memo row').toBeLessThan(withMemo.height - memo.height / 2);
});

test('shows Debit and Credit side by side at 390px, each compact line with its tile, name and arrow and its amount told only to assistive technology, keeping the Debit and Credit column headers', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL, LUNCH]);

  for (const posted of [PAYROLL, LUNCH]) {
    await expectCompact(listedHeading(page, posted), shownLines(posted));
    await expectWithinPhone(page, listedHeading(page, posted));
  }
  for (const side of ['Debit', 'Credit'] as const) {
    await expect(entries(page).getByRole('columnheader', { name: side, exact: true })).toHaveCount(1);
  }
});

test('puts a collapsed chevron at 390px only on an Entry with more than one line on a Side', async ({ page }) => {
  test.slow();
  await openEntriesWith(page, [PAYROLL, SPLIT_BILL, LUNCH]);

  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await expectExpanded(listedHeading(page, posted), posted, false);
    await expectChevronNamesAnAction(listedHeading(page, posted), posted);
  }
  await expectNoChevron(listedHeading(page, LUNCH));
});

test('names the chevron at 390px by an action, the Entry date and its memo when the Entry has no Title', async ({ page }) => {
  await openEntriesWith(page, [TAXI]);
  const entry = listedHeading(page, TAXI);

  await expectExpanded(entry, TAXI, false);
  await expectChevronNamesAnAction(entry, TAXI);
  await chevron(entry, TAXI).click();
  await expectExpanded(entry, TAXI, true);
  await expectChevronNamesAnAction(entry, TAXI);
  await expectDetailed(entry, shownLines(TAXI), 'stacked');
});

test('expands an Entry at 390px by its chevron, stacking its lines under their Side names with their amounts, and collapses it by the chevron again', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listedHeading(page, PAYROLL);

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
  const entry = listedHeading(page, SPLIT_BILL);

  await firstLineName(entry, SPLIT_BILL).click();
  await expectExpanded(entry, SPLIT_BILL, true);
  await expectDetailed(entry, shownLines(SPLIT_BILL), 'stacked');

  await entryMemo(entry, SPLIT_BILL).click();
  await expectExpanded(entry, SPLIT_BILL, false);
  await expectCompact(entry, shownLines(SPLIT_BILL));
});

test('reaches the chevron at 390px with Tab, passing over the Entry body, and expands and collapses the Entry by Enter and Space', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listedHeading(page, PAYROLL);

  await tabToChevronPassingOver(page, entry, chevron(entry, PAYROLL));
  await page.keyboard.press('Enter');
  await expectExpanded(entry, PAYROLL, true);
  await expectDetailed(entry, shownLines(PAYROLL), 'stacked');

  await page.keyboard.press('Space');
  await expectExpanded(entry, PAYROLL, false);
  await expectCompact(entry, shownLines(PAYROLL));
});

test('never toggles an Entry at 390px for Edit, Delete, a click in their dialogs, or a text selection', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listedHeading(page, PAYROLL);

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
  const entry = listedHeading(page, LUNCH);

  await firstLineName(entry, LUNCH).click();
  await entryMemo(entry, LUNCH).click();

  await expectNoChevron(entry);
  await expectCompact(entry, shownLines(LUNCH));
});

test('keeps several Entries expanded at once at 390px, and starts every Entry collapsed again on a reload', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL, SPLIT_BILL]);

  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await chevron(listedHeading(page, posted), posted).click();
  }
  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await expectExpanded(listedHeading(page, posted), posted, true);
    await expectDetailed(listedHeading(page, posted), shownLines(posted), 'stacked');
  }

  await page.reload();
  for (const posted of [PAYROLL, SPLIT_BILL]) {
    await expectExpanded(listedHeading(page, posted), posted, false);
    await expectCompact(listedHeading(page, posted), shownLines(posted));
  }
});

test('keeps an Entry expanded at 390px through a widening of the window to 1280px and back', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  const entry = listedHeading(page, PAYROLL);
  await chevron(entry, PAYROLL).click();
  await expectExpanded(entry, PAYROLL, true);

  await page.setViewportSize(WIDE);
  await expectDetailed(entry, shownLines(PAYROLL), 'side by side');
  await page.setViewportSize(PHONE);

  await expectExpanded(entry, PAYROLL, true);
  await expectDetailed(entry, shownLines(PAYROLL), 'stacked');
});

test('keeps the compact layout and the chevron at 800px, where the list beside the Sidebar is under 40rem', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL, LUNCH], WIDE_BESIDE_SIDEBAR);

  await expectCompact(listedHeading(page, PAYROLL), shownLines(PAYROLL));
  await expectCompact(listedHeading(page, LUNCH), shownLines(LUNCH));
  await expectNoChevron(listedHeading(page, LUNCH));

  await chevron(listedHeading(page, PAYROLL), PAYROLL).click();
  await expectExpanded(listedHeading(page, PAYROLL), PAYROLL, true);
  await expectDetailed(listedHeading(page, PAYROLL), shownLines(PAYROLL), 'stacked');
});

for (const width of [WIDE_BELOW_SPLIT, WIDE]) {
  test(`shows every Entry at ${String(width.width)}px on a one-row header with no chevron, its lines under their Side names with their amounts, and keeps a long memo and a large amount clear of the actions`, async ({ page }) => {
    test.slow();
    await openEntriesWith(page, [PAYROLL, LUNCH, RENT], width);

    for (const posted of [PAYROLL, LUNCH, RENT]) {
      const entry = listedHeading(page, posted);
      await expectNoChevron(entry);
      await expectOneRowHeader(entry, posted);
      await expectDetailed(entry, shownLines(posted), 'side by side');
    }
  });
}

test('runs View Transition animations right after an Entry expands at 390px', async ({ page }) => {
  await openEntriesWith(page, [PAYROLL]);
  await recordViewTransitions(page);

  await chevron(listedHeading(page, PAYROLL), PAYROLL).click();

  await expect.poll(() => viewTransitionAnimations(page), { timeout: 2000 }).toBeGreaterThan(0);
  await expectExpanded(listedHeading(page, PAYROLL), PAYROLL, true);
});

test('expands an Entry at 390px at once, with no View Transition animation, when the User prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEntriesWith(page, [PAYROLL]);
  await recordViewTransitions(page);

  await chevron(listedHeading(page, PAYROLL), PAYROLL).click();

  await expectExpanded(listedHeading(page, PAYROLL), PAYROLL, true);
  await waitFrames(page, 30);
  expect(await viewTransitionAnimations(page)).toBe(0);
  await expectDetailed(listedHeading(page, PAYROLL), shownLines(PAYROLL), 'stacked');
});

test('shows the results of Entry search at 390px compact, expands one by its chevron, and starts a new search with every result collapsed', async ({ page }) => {
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

async function expectNamesReadable(page: Page, entry: Locator, lines: readonly ShownLine[]): Promise<void> {
  await expectWithinPhone(page, entry);
  for (const shown of lines) {
    await expectOnOneLine(nameIn(entry, shown), `${shown.name} on ${shown.side}`);
  }
}

async function expectLongKoreanNamesReadable(
  page: Page,
  posted: LongKoreanNames,
  list: (heading: MultiLineEntry) => Locator,
): Promise<void> {
  const severalPerSide = list(posted.severalPerSide);
  const several = shownLines(posted.severalPerSide);

  for (const heading of [posted.severalPerSide, posted.onePerSide]) {
    await expectCompact(list(heading), shownLines(heading));
    await expectNamesReadable(page, list(heading), shownLines(heading));
  }

  await chevron(severalPerSide, posted.severalPerSide).click();
  await expectExpanded(severalPerSide, posted.severalPerSide, true);
  await expectDetailed(severalPerSide, several, 'stacked');
  await expectNamesReadable(page, severalPerSide, several);
  for (const shown of several) {
    const lineBox = await boxOf(lineOf(severalPerSide, shown), `${shown.name}'s line`);
    const amountBox = await boxOf(lineOf(severalPerSide, shown).getByText(shown.amount, { exact: true }), `${shown.name}'s amount`);
    expect(amountBox.x + amountBox.width, `${shown.name}'s amount ends at the line's right edge`).toBeGreaterThanOrEqual(
      lineBox.x + lineBox.width - 1,
    );
  }
}

test('keeps each long Korean Account name readable at 390px in the Entries list, compact and expanded, with no horizontal overflow', async ({ page }) => {
  const posted = await postLongKoreanNames(page);
  await page.setViewportSize(PHONE);
  await page.goto('/entries');

  await expectLongKoreanNamesReadable(page, posted, (heading) => listedHeading(page, heading));
});

test('keeps each long Korean Account name readable at 390px in Entry search, compact and expanded, with no horizontal overflow', async ({ page }) => {
  const posted = await postLongKoreanNames(page);
  await page.setViewportSize(PHONE);
  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, {});

  await expectLongKoreanNamesReadable(page, posted, (heading) => resultFor(page, heading.memo));
});
