import { expect, test, type Page } from '@playwright/test';
import { signIn } from './session';
import { SIGNED_IN_PAGES } from './sidebar';
import { PHONE } from './viewport';

const PAGE_HEADINGS: Record<(typeof SIGNED_IN_PAGES)[number], string> = {
  '/entries': 'Entries',
  '/entries/search': 'Entry search',
  '/settings': 'Settings',
};

async function expectEachPageNamedByOneHeading(page: Page): Promise<void> {
  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: PAGE_HEADINGS[path], exact: true }),
    ).toBeVisible();
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
