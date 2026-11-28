import { expect, test } from '@playwright/test';
import { expectShell, REPORT_PAGES, resultText, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections } from './section-states';

for (const view of REPORT_PAGES) {
  test(`${view.name}: returns only the result to its Skeleton when a filter changes, and keeps what was typed`, async ({ page }) => {
    const seeded = await signInWithSeededEntries(page);
    const faults = await injectFaults(page);
    await page.goto(view.first.path);
    await expect(resultText(page)).toContainText(view.first.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);

    await faults.set({ [view.report.id]: 'hold' });
    await view.second.apply(page);

    await expect(busySections(page)).toHaveCount(1);
    await expectShell(page, view);
    await view.second.expectTyped(page);
    await expect(resultText(page)).not.toContainText(view.first.figure(seeded));

    await faults.release(view.report.id);

    await expect(resultText(page)).toContainText(view.second.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);
    await view.second.expectTyped(page);
  });
}
