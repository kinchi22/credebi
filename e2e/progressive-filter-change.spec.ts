import { expect, test } from '@playwright/test';
import { expectShell, REPORT_PAGES, resultText, signInWithSeededEntries } from './progressive-pages';
import { busySections, injectFaults } from './section-faults';

for (const view of REPORT_PAGES) {
  const { filters } = view;
  const [report] = view.sections;
  if (filters === undefined || report === undefined) continue;

  test(`${view.name}: returns only the result to its Skeleton when a filter changes, and keeps what was typed`, async ({ page }) => {
    const seeded = await signInWithSeededEntries(page);
    const faults = await injectFaults(page);
    await page.goto(filters.first.path);
    await expect(resultText(page)).toContainText(filters.first.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);

    await faults.set({ [report.id]: 'hold' });
    await filters.second.apply(page);

    await expect(busySections(page)).toHaveCount(1);
    await expectShell(page, view);
    await filters.second.expectTyped(page);
    await expect(resultText(page)).not.toContainText(filters.first.figure(seeded));

    await faults.release(report.id);

    await expect(resultText(page)).toContainText(filters.second.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);
    await filters.second.expectTyped(page);
  });
}
