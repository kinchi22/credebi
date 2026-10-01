import path from 'node:path';
import { test } from '@playwright/test';

test.use({ launchOptions: { executablePath: path.join(import.meta.dirname, 'missing-chromium') } });

test('opens the page with a browser that cannot launch', async ({ page }) => {
  await page.goto('/');
});
