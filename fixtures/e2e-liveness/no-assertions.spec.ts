import { test } from '@playwright/test';

test('opens the page without checking app behaviour', async ({ page }) => {
  await page.goto('/');
});
