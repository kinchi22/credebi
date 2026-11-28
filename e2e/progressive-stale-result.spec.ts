import { expect, test, type Page, type Request } from '@playwright/test';
import { REPORT_PAGES, resultText, signInWithSeededEntries } from './progressive-pages';
import { busySections, injectFaults } from './section-faults';

const settledRequest = (page: Page, matches: (request: Request) => boolean): Promise<unknown> =>
  Promise.race([
    page.waitForEvent('requestfinished', matches).catch(() => undefined),
    page.waitForEvent('requestfailed', matches).catch(() => undefined),
  ]);

for (const view of REPORT_PAGES) {
  const { filters } = view;
  const [report] = view.sections;
  if (filters === undefined || report === undefined) continue;

  test(`${view.name}: shows only the figures of the latest filter when an earlier one is released late`, async ({ page }) => {
    const seeded = await signInWithSeededEntries(page);
    const faults = await injectFaults(page);
    await page.goto(filters.quiet.path);
    await expect(busySections(page)).toHaveCount(0);

    await faults.set({ [report.id]: 'hold' });
    const firstSettled = settledRequest(page, (request) => request.url().includes(new URL(filters.first.path, request.url()).search.slice(1)));
    await filters.first.apply(page);
    await expect(busySections(page)).toHaveCount(1);

    await faults.set({});
    await filters.second.apply(page);
    await expect(resultText(page)).toContainText(filters.second.figure(seeded));
    await expect(busySections(page)).toHaveCount(0);

    await faults.release(report.id);
    await firstSettled;

    await expect(resultText(page)).toContainText(filters.second.figure(seeded));
    await expect(resultText(page)).not.toContainText(filters.first.figure(seeded));
    await filters.second.expectTyped(page);
  });
}
