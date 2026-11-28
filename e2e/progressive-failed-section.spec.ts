import { expect, test } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults } from './section-faults';
import { busySections, sectionError, tryAgain } from './section-states';

for (const view of PAGES) {
  for (const failing of view.sections) {
    test(`${view.name}: says ${failing.id} could not load while its neighbours stay usable, and shows it after Try again once the fault is lifted`, async ({ page }) => {
      const seeded = await signInWithSeededEntries(page);
      const faults = await injectFaults(page, { [failing.id]: 'fail' });

      await page.goto(view.path);

      await expectShell(page, view);
      await expect(sectionError(page)).toHaveCount(1);
      await expect(tryAgain(page)).toHaveCount(1);
      await expect(busySections(page)).toHaveCount(0);
      await expect(failing.content(page, seeded)).toHaveCount(0);
      for (const other of view.sections.filter((section) => section !== failing)) {
        await expect(other.content(page, seeded)).toBeVisible();
        if (other.controls !== undefined) await expect(other.controls(page)).toBeEnabled();
      }

      await faults.set({});
      await tryAgain(page).click();

      await expect(failing.content(page, seeded)).toBeVisible();
      await expect(tryAgain(page)).toHaveCount(0);
      await expect(sectionError(page)).toHaveCount(0);
    });
  }
}
