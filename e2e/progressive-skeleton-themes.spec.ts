import { expect, test, type Locator } from '@playwright/test';
import { expectShell, PAGES, signInWithSeededEntries } from './progressive-pages';
import { busySections, injectFaults, skeletonBlocks, type FaultModes } from './section-faults';
import { PHONE, WIDE } from './viewport';

const SCHEMES = ['light', 'dark'] as const;

const LAYOUTS = [
  { name: 'narrow', size: PHONE, tag: ['@webkit'] },
  { name: 'wide', size: WIDE, tag: [] },
] as const;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const PAINT_AND_GROUND = `(element) => {
  const transparent = '${TRANSPARENT}';
  const paint = getComputedStyle(element).backgroundColor;
  let ground = transparent;
  for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const colour = getComputedStyle(ancestor).backgroundColor;
    if (colour !== transparent) {
      ground = colour;
      break;
    }
  }
  return paint + '|' + ground;
}`;

const paintAndGround = async (block: Locator): Promise<readonly string[]> =>
  String(await block.evaluate(PAINT_AND_GROUND)).split('|');

for (const view of PAGES) {
  for (const scheme of SCHEMES) {
    for (const layout of LAYOUTS) {
      test(
        `${view.name}: draws every Skeleton visibly against the page in the ${scheme} theme at ${layout.name} width`,
        { tag: [...layout.tag] },
        async ({ page }) => {
          await signInWithSeededEntries(page);
          await page.emulateMedia({ colorScheme: scheme });
          await page.setViewportSize(layout.size);
          const held: FaultModes = Object.fromEntries(view.sections.map((section) => [section.id, 'hold']));
          await injectFaults(page, held);

          await page.goto(view.path);

          await expectShell(page, view);
          const busy = busySections(page);
          await expect(busy).toHaveCount(view.sections.length);
          for (const section of await busy.all()) {
            const block = skeletonBlocks(section).first();
            await expect(block).toBeVisible();
            const [paint, ground] = await paintAndGround(block);
            expect(paint, 'a Skeleton block is painted').not.toBe(TRANSPARENT);
            expect(paint, 'a Skeleton block differs from the ground it sits on').not.toBe(ground);
            const box = await section.boundingBox();
            expect((box?.x ?? Number.NaN) + (box?.width ?? Number.NaN)).toBeLessThanOrEqual(layout.size.width);
          }
          expect(Number(await page.evaluate('document.documentElement.scrollWidth'))).toBeLessThanOrEqual(layout.size.width);
        },
      );
    }
  }
}
