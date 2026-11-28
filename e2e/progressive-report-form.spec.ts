import { expect, test } from '@playwright/test';
import { boxOf } from './accounts';
import { expectShell, REPORT_PAGES, signInWithSeededEntries } from './progressive-pages';
import { busySections, injectFaults, loadingMessages, skeletonBlocks } from './section-faults';

for (const view of REPORT_PAGES) {
  const { filters, form } = view;
  const [report] = view.sections;
  if (filters === undefined || form === undefined || report === undefined) continue;

  test(`${view.name}: shows the form with what the URL holds while its result is held`, async ({ page }) => {
    await signInWithSeededEntries(page);
    const faults = await injectFaults(page, { [report.id]: 'hold' });

    await page.goto(filters.second.path);

    await expectShell(page, view);
    await expect(busySections(page)).toHaveCount(1);
    await filters.second.expectTyped(page);

    await faults.release(report.id);

    await expect(busySections(page)).toHaveCount(0);
  });

  test(`${view.name}: shows the result's Skeleton on a cold visit, with no loading text on screen`, async ({ page }) => {
    await signInWithSeededEntries(page);
    const faults = await injectFaults(page, { [report.id]: 'hold' });

    await page.goto(view.pathWithoutQuery ?? view.path);

    await expectShell(page, view);
    const busy = busySections(page);
    await expect(busy).toHaveCount(1);
    await expect(skeletonBlocks(busy).first()).toBeVisible();
    await expect(loadingMessages(busy)).toHaveCount(1);
    const message = await boxOf(loadingMessages(busy), 'the loading message');
    expect(message.width).toBeLessThanOrEqual(1);
    expect(message.height).toBeLessThanOrEqual(1);

    await faults.release(report.id);

    await expect(busy).toHaveCount(0);
    await expectShell(page, view);
  });
}
