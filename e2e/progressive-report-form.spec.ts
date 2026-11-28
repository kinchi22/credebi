import { expect, test } from '@playwright/test';
import { boxOf } from './accounts';
import { expectShell, REPORT_PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections, loadingMessages, skeletonBlocks } from './section-states';

for (const view of REPORT_PAGES) {
  test(`${view.name}: shows the form with what the URL holds while its result is held`, async ({ page }) => {
    await signInWithSeededEntries(page);
    const faults = await injectFaults(page, { [view.report.id]: 'hold' });

    await page.goto(view.second.path, { waitUntil: 'commit' });

    await expectShell(page, view);
    await expect(busySections(page)).toHaveCount(1);
    await view.second.expectTyped(page);

    await faults.release(view.report.id);

    await expect(busySections(page)).toHaveCount(0);
  });

  test(`${view.name}: shows the result's Skeleton on a cold visit, with no loading text on screen`, async ({ page }) => {
    await signInWithSeededEntries(page);
    const faults = await injectFaults(page, { [view.report.id]: 'hold' });

    await page.goto(view.pathWithoutQuery, { waitUntil: 'commit' });

    await expectShell(page, view);
    const busy = busySections(page);
    await expect(busy).toHaveCount(1);
    await expect(skeletonBlocks(busy).first()).toBeVisible();
    await expect(loadingMessages(busy)).toHaveCount(1);
    const message = await boxOf(loadingMessages(busy), 'the loading message');
    expect(message.width).toBeLessThanOrEqual(1);
    expect(message.height).toBeLessThanOrEqual(1);

    await faults.release(view.report.id);

    await expect(busy).toHaveCount(0);
    await expectShell(page, view);
  });
}
