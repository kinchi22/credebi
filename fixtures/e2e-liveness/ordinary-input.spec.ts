import { expect, test } from '@playwright/test';
import { deferInput } from './deferred-input';

test('fills an input appearing after more than one second', async ({ page }) => {
  await page.setContent('<body></body>');
  await deferInput(page);
  await page.getByLabel('Deferred input').fill('value');
  await expect(page.getByLabel('Deferred input')).toHaveValue('value');
});
