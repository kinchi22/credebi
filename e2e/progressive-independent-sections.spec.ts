import { expect, test } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { busySections, injectFaults } from './section-faults';

for (const view of PAGES) {
  const [first, second] = view.sections;
  if (first === undefined || second === undefined) continue;

  for (const [earlier, later] of [
    [first, second],
    [second, first],
  ] as const) {
    test(`${view.name}: resolves ${earlier.id} and ${later.id} independently when ${earlier.id} is released first`, async ({ page }) => {
      const seeded = await signInWithSeededEntries(page);
      const faults = await injectFaults(page, { [first.id]: 'hold', [second.id]: 'hold' });

      await page.goto(view.path);

      await expectShell(page, view);
      await expect(busySections(page)).toHaveCount(2);

      await faults.release(earlier.id);

      await expect(earlier.content(page, seeded)).toBeVisible();
      await expect(busySections(page)).toHaveCount(1);
      await expect(later.content(page, seeded)).toHaveCount(0);

      await faults.release(later.id);

      await expect(later.content(page, seeded)).toBeVisible();
      await expect(busySections(page)).toHaveCount(0);
    });
  }
}
