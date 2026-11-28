import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { accountChoice, entryForm, fillHeading } from './entries';
import { injectFaults } from './section-faults';
import { busySections } from './section-states';
import { BOOKS_OPEN, signIn } from './session';

test('lets a User fill in the entry form while the Entries list is held', async ({ page }) => {
  const memo = `Typed beside a held list ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const faults = await injectFaults(page, { 'entries.list': 'hold' });

  await page.goto('/entries');

  await expect(busySections(page)).toHaveCount(1);
  const form = entryForm(page);
  await expect(form).toBeVisible();
  await fillHeading(form, { day: '2026-06-10', memo });
  await accountChoice(form, 'Debit', 'Food').check();
  await accountChoice(form, 'Credit', 'Cash').check();
  await form.getByLabel('Amount').fill('12500');

  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expect(accountChoice(form, 'Debit', 'Food')).toBeChecked();
  await expect(busySections(page)).toHaveCount(1);

  await faults.release('entries.list');

  await expect(busySections(page)).toHaveCount(0);
});
