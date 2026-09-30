import { expect, test } from '@playwright/test';
import { deferInput } from './deferred-input';

test('fills an input that appears after the liveness action budget', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await deferInput(page);
  await page.getByLabel('Deferred input').fill('value');
  await expect(page.getByLabel('Deferred input')).toHaveValue('value');
});
