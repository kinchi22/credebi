import { expect, test } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections, expectOnlyLoadingMessageExposed, loadingMessages, skeletonBlocks } from './section-states';

for (const view of PAGES) {
  for (const held of view.sections) {
    test(`${view.name}: marks ${held.id} busy with one status message and keeps its blocks out of the accessibility tree`, async ({ page }) => {
      await signInWithSeededEntries(page);
      await injectFaults(page, { [held.id]: 'hold' });

      await page.goto(view.path, { waitUntil: 'commit' });

      await expectShell(page, view);
      const busy = busySections(page);
      await expect(busy).toHaveCount(1);
      await expect(loadingMessages(busy)).toHaveCount(1);
      await expect(loadingMessages(busy)).not.toHaveText('');
      await expect(skeletonBlocks(busy).first()).toBeVisible();
      await expectOnlyLoadingMessageExposed(busy);
    });
  }
}
