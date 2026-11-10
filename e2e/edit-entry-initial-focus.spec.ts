import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { DAY, entryForm, listedEntry, openEditEntry, submitTwoLineEntryOnPhone, twoLine } from './entries';
import { signInForWebKit } from './session';
import { PHONE } from './viewport';

test('opens Edit entry at 390px with focus on the dialog and on none of its form controls', { tag: '@webkit' }, async ({ page, baseURL }) => {
  const memo = `Bus fare ${randomUUID()}`;
  await page.setViewportSize(PHONE);
  await signInForWebKit(page, baseURL, { accountsStartOn: BOOKS_OPEN });
  await submitTwoLineEntryOnPhone(entryForm(page), twoLine({ day: DAY, memo }));

  const dialog = await openEditEntry(listedEntry(page, memo));

  await expect(dialog, 'focus starts on the Edit entry dialog itself, not on a form control').toBeFocused();
  await expect(dialog.getByLabel('Date'), 'focus on Date opens the date picker over the form uninvited').not.toBeFocused();
});
