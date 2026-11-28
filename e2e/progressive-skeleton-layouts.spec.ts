import { expect, test, type Locator } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { injectFaults, type FaultModes } from './section-faults';
import { busySections, skeletonBlocks } from './section-states';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const LAYOUTS = [
  { name: 'narrow', size: PHONE },
  { name: 'wide', size: WIDE },
] as const;

type Styled = {
  readonly parentElement: Styled | null;
  readonly ownerDocument: { readonly defaultView: { getComputedStyle(each: Styled): { backgroundColor: string } } | null };
  readonly querySelectorAll: (selectors: string) => ArrayLike<Styled>;
};

const paintsAgainstGround = (section: Locator): Promise<boolean> =>
  section.evaluate((root: Styled) => {
    const transparent = 'rgba(0, 0, 0, 0)';
    const paintOf = (each: Styled): string =>
      each.ownerDocument.defaultView?.getComputedStyle(each).backgroundColor ?? transparent;
    let ground = transparent;
    for (let ancestor: Styled | null = root; ancestor !== null; ancestor = ancestor.parentElement) {
      const colour = paintOf(ancestor);
      if (colour !== transparent) {
        ground = colour;
        break;
      }
    }
    return Array.from(root.querySelectorAll('[aria-hidden="true"]')).some((block) => {
      const paint = paintOf(block);
      return paint !== transparent && paint !== ground;
    });
  });

for (const view of PAGES) {
  for (const layout of LAYOUTS) {
    test(`${view.name}: draws every Skeleton visibly against the page at ${layout.name} width`, async ({ page }) => {
      await signInWithSeededEntries(page);
      await page.setViewportSize(layout.size);
      const held: FaultModes = Object.fromEntries(view.sections.map((section) => [section.id, 'hold']));
      await injectFaults(page, held);

      await page.goto(view.path, { waitUntil: 'commit' });

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
