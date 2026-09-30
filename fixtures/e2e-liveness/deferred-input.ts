import type { Page } from '@playwright/test';

export async function deferInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    setTimeout(() => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Deferred input');
      document.body.append(input);
    }, 4000);
  });
}
