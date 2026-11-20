import { test } from '@playwright/test';
import { expectLeftOf, expectOnOneRow } from './account-type-cues';
import { listedHeading } from './entries';
import { firstOn, lineOf, nameIn, postLongKoreanNames, shownLines } from './entry-density';
import { WIDE } from './viewport';

test('keeps Debit and Credit side by side at 1280px in the Entries list', async ({ page }) => {
  test.slow();
  const posted = await postLongKoreanNames(page);

  await page.setViewportSize(WIDE);
  await page.goto('/entries');

  for (const heading of [posted.severalPerSide, posted.onePerSide]) {
    const entry = listedHeading(page, heading);
    const lines = shownLines(heading);
    const debit = firstOn(lines, 'Debit');
    const credit = firstOn(lines, 'Credit');
    await expectLeftOf(lineOf(entry, debit), lineOf(entry, credit), `${heading.memo}: Debit and Credit`);
    await expectOnOneRow(nameIn(entry, debit), nameIn(entry, credit), `${heading.memo}: the first line of each Side`);
  }
});
