import { expect, test } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections } from './section-states';

for (const view of PAGES) {
  for (const held of view.sections) {
    test(`${view.name}: shows the heading and every other section while ${held.id} shows its Skeleton, then its content once released`, async ({ page }) => {
      const seeded = await signInWithSeededEntries(page);
      const faults = await injectFaults(page, { [held.id]: 'hold' });

      await page.goto(view.path, { waitUntil: 'commit' });

      await expectShell(page, view);
      await expect(busySections(page)).toHaveCount(1);
      await expect(held.content(page, seeded)).toHaveCount(0);
      for (const other of view.sections.filter((section) => section !== held)) {
        await expect(other.content(page, seeded)).toBeVisible();
      }

      await faults.release(held.id);

      await expect(held.content(page, seeded)).toBeVisible();
      await expect(busySections(page)).toHaveCount(0);
    });
  }
}
