import { expect, test } from '@playwright/test';
import { PAGES } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections, sectionError, tryAgain } from './section-states';
import { BOOKS_OPEN, signIn } from './session';

for (const view of PAGES) {
  for (const section of view.sections) {
    const { empty } = section;
    if (empty === undefined) continue;

    test(`${view.name}: reads ${section.id} as empty, apart from loading and from failed`, async ({ page }) => {
      await signIn(page, { accountsStartOn: BOOKS_OPEN });
      const faults = await injectFaults(page);

      await page.goto(view.path);

      await expect(empty(page)).toBeVisible();
      await expect(busySections(page)).toHaveCount(0);
      await expect(tryAgain(page)).toHaveCount(0);
      await expect(sectionError(page)).toHaveCount(0);

      await faults.set({ [section.id]: 'hold' });
      await page.goto(view.path, { waitUntil: 'commit' });

      await expect(busySections(page)).toHaveCount(1);
      await expect(empty(page)).toHaveCount(0);
      await expect(tryAgain(page)).toHaveCount(0);
      await faults.release(section.id);
      await expect(empty(page)).toBeVisible();

      await faults.set({ [section.id]: 'fail' });
      await page.goto(view.path);

      await expect(tryAgain(page)).toBeVisible();
      await expect(empty(page)).toHaveCount(0);
      await expect(busySections(page)).toHaveCount(0);
    });
  }
}
