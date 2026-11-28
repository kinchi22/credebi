import { expect, test } from '@playwright/test';
import { boxOf } from './accounts';
import { PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections } from './section-states';

for (const view of PAGES) {
  for (const held of view.sections) {
    const { frame } = held;
    if (frame === undefined) continue;

    test(`${view.name}: draws the ${held.id} Skeleton at the top position of its content`, async ({ page }) => {
      await signInWithSeededEntries(page);
      const faults = await injectFaults(page, { [held.id]: 'hold' });

      await page.goto(view.path, { waitUntil: 'commit' });

      const busy = busySections(page);
      await expect(busy).toHaveCount(1);
      const skeletonTop = (await boxOf(busy, 'the Skeleton')).y;

      await faults.release(held.id);

      await expect(frame(page)).toBeVisible();
      await expect(busy).toHaveCount(0);
      expect((await boxOf(frame(page), 'the content')).y).toBeCloseTo(skeletonTop, 0);
    });
  }
}
