import { expect, test } from '@playwright/test';
import { REPORT_PAGES, resultText, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections } from './section-states';

for (const view of REPORT_PAGES) {
  test(`${view.name}: shows only the figures of the latest filter when an earlier one is released late`, async ({ page }) => {
    const seeded = await signInWithSeededEntries(page);
    const faults = await injectFaults(page);
    await page.goto(view.quietPath);
    await expect(view.form(page)).toBeVisible();
    await expect((view.report.empty ?? view.report.content)(page, seeded)).toBeVisible();

    await faults.set({ [view.report.id]: 'hold' });
    await view.first.apply(page);
    await expect(busySections(page)).toHaveCount(1);

    await faults.set({});
    await view.second.apply(page);
    await expect(resultText(page)).toContainText(view.second.figure(seeded));

    await faults.release(view.report.id);

    await expect(resultText(page)).toContainText(view.second.figure(seeded));
    await expect(resultText(page)).not.toContainText(view.first.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);
    await view.second.expectTyped(page);
  });
}
