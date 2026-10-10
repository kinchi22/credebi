import { expect, test, type Page } from '@playwright/test';
import { signIn } from './session';
import { PHONE } from './viewport';

const PAGE_HEADINGS = [
  { path: '/entries', name: 'Entries' },
  { path: '/entries/search', name: 'Entry search' },
  { path: '/settings', name: 'Settings' },
] as const;

async function expectEachPageNamedByOneHeading(page: Page): Promise<void> {
  for (const { path, name } of PAGE_HEADINGS) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  }
}

test('names each signed-in page by exactly one level-1 heading on a wide window', async ({ page }) => {
  await signIn(page);

  await expectEachPageNamedByOneHeading(page);
});

test('names each signed-in page by exactly one level-1 heading at 390px', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await expectEachPageNamedByOneHeading(page);
});
