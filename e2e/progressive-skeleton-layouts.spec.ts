import { expect, test, type Locator } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults, type FaultModes } from './section-faults';
import { busySections, skeletonBlocks } from './section-states';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const LAYOUTS = [
  { name: 'narrow', size: PHONE },
  { name: 'wide', size: WIDE },
] as const;

const SOME_BLOCK_DIFFERS_FROM_GROUND = `(section) => {
  const transparent = 'rgba(0, 0, 0, 0)';
  let ground = transparent;
  for (let ancestor = section; ancestor !== null; ancestor = ancestor.parentElement) {
    const colour = getComputedStyle(ancestor).backgroundColor;
    if (colour !== transparent) {
      ground = colour;
      break;
    }
  }
  return Array.from(section.querySelectorAll('[aria-hidden="true"]')).some((block) => {
    const paint = getComputedStyle(block).backgroundColor;
    return paint !== transparent && paint !== ground;
  });
}`;

const paintsAgainstGround = (section: Locator): Promise<unknown> =>
  section.evaluate(SOME_BLOCK_DIFFERS_FROM_GROUND);

for (const view of PAGES) {
  for (const layout of LAYOUTS) {
    test(`${view.name}: draws every Skeleton visibly against the page at ${layout.name} width`, async ({ page }) => {
      await signInWithSeededEntries(page);
      await page.setViewportSize(layout.size);
      const held: FaultModes = Object.fromEntries(view.sections.map((section) => [section.id, 'hold']));
      await injectFaults(page, held);

      await page.goto(view.path);

      await expectShell(page, view);
      const busy = busySections(page);
      await expect(busy).toHaveCount(view.sections.length);
      for (const section of await busy.all()) {
        await expect(skeletonBlocks(section).first()).toBeVisible();
        expect(await paintsAgainstGround(section), 'a Skeleton block is painted and differs from its ground').toBe(true);
      }
      if (layout.size === PHONE) {
        for (const section of await busy.all()) await expectWithinPhone(page, section);
      }
    });
  }
}
