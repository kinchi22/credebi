import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { entries, escaped, listedEntry, openEditEntry, postEntries, saveEdit, twoLine } from './entries';
import { results, search } from './entry-search';
import { ENTRY_SEARCH_PATH as SEARCH } from './routes';
import { BOOKS_OPEN, signIn } from './session';

const LATER_DAY = '2026-09-20';

const EARLIER_DAY = '2026-09-10';

const EDITED_DAY = '2026-09-25';

const posted = (memo: string, day: string) => twoLine({ day, memo });

async function expectOrder(region: Locator, memos: readonly string[]): Promise<void> {
  await expect(region.getByTestId('entry')).toHaveText(memos.map((memo) => new RegExp(escaped(memo))));
}

const expectLogOrder = (page: Page, memos: readonly string[]): Promise<void> =>
  expectOrder(entries(page), memos);

const expectResultOrder = (page: Page, memos: readonly string[]): Promise<void> =>
  expectOrder(results(page), memos);

async function changeDay(page: Page, memo: string, day: string): Promise<void> {
  const dialog = await openEditEntry(listedEntry(page, memo));
  await dialog.getByLabel('Date').fill(day);
  await saveEdit(dialog);
  await expect(listedEntry(page, memo)).toContainText(day);
}

test('lists an Entry posted on a past calendar day above an Entry posted earlier on a later day in the Entry log', async ({ page }) => {
  const run = randomUUID();
  const onLaterDay = `Later day ${run}`;
  const onEarlierDay = `Earlier day ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(onLaterDay, LATER_DAY), posted(onEarlierDay, EARLIER_DAY)]);

  await page.goto('/entries');
  await expectLogOrder(page, [onEarlierDay, onLaterDay]);
});

test('lists several Entries in the Entry log in reverse order of posting, after a reload too', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const second = `Second ${run}`;
  const third = `Third ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(first, '2026-09-12'), posted(second, '2026-09-18'), posted(third, '2026-09-14')]);

  await page.goto('/entries');
  await expectLogOrder(page, [third, second, first]);
  await page.reload();
  await expectLogOrder(page, [third, second, first]);
});

test('leaves the middle Entry in place in the Entry log when it is edited, its calendar day included', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const middle = `Middle ${run}`;
  const last = `Last ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(first, '2026-09-12'), posted(middle, '2026-09-14'), posted(last, '2026-09-16')]);

  await page.goto('/entries');
  await changeDay(page, middle, EDITED_DAY);

  await expectLogOrder(page, [last, middle, first]);
  await page.reload();
  await expectLogOrder(page, [last, middle, first]);
});

test('leaves an Entry in place in the Entry log when it is edited twice', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const middle = `Middle ${run}`;
  const last = `Last ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(first, '2026-09-12'), posted(middle, '2026-09-14'), posted(last, '2026-09-16')]);

  await page.goto('/entries');
  await changeDay(page, middle, EDITED_DAY);
  await changeDay(page, middle, EARLIER_DAY);

  await expectLogOrder(page, [last, middle, first]);
  await page.reload();
  await expectLogOrder(page, [last, middle, first]);
});

test('orders Entry search results by calendar day, latest first, whatever the order of posting', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const earliest = `Earliest ${run}`;
  const latest = `Latest ${run}`;
  const middle = `Middle ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(middle, '2026-09-14'), posted(earliest, EARLIER_DAY), posted(latest, LATER_DAY)]);

  await page.goto(SEARCH);
  await search(page, { memo: run });

  await expectResultOrder(page, [latest, middle, earliest]);
});

test('orders Entry search results on the same calendar day with the later-posted Entry first', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const first = `First ${run}`;
  const second = `Second ${run}`;
  const third = `Third ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted(first, LATER_DAY), posted(second, LATER_DAY), posted(third, LATER_DAY)]);

  await page.goto(SEARCH);
  await search(page, { memo: run });

  await expectResultOrder(page, [third, second, first]);
});
