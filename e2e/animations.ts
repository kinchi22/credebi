import { type Page } from '@playwright/test';

export type SlideFrom = 'right' | 'left' | 'none';

const SLID_AT_LEAST_PX = 8;

export const VIEW_TRANSITION_ANIMATION =
  "(animation) => String(animation.effect && animation.effect.pseudoElement).startsWith('::view-transition')";

const SLIDING = `(animation) => {
  const target = animation.effect && animation.effect.target;
  if (!(target instanceof Element)) return false;
  const panel = target.closest('[role="tabpanel"]');
  if (panel === null || panel.getClientRects().length === 0) return false;
  return animation.effect.getKeyframes().some((keyframe) => 'transform' in keyframe || 'translate' in keyframe);
}`;

const NO_SAMPLING = '() => {}';

const SAMPLING_PANELS = `() => {
  const left = (element) => (element === null ? Number.NaN : element.getBoundingClientRect().left);
  for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
    if (panel.getClientRects().length === 0) continue;
    if (window.tabpanelLefts[panel.id] === undefined) window.tabpanelLefts[panel.id] = [];
    window.tabpanelLefts[panel.id].push([left(panel), left(panel.firstElementChild)]);
  }
}`;

async function install(page: Page, counted: string, sampling: string): Promise<void> {
  await page.evaluate(`(() => {
    window.animationsSeen = 0;
    window.tabpanelLefts = {};
    const seen = new WeakSet();
    const counted = ${counted};
    const sample = ${sampling};
    const look = () => {
      for (const animation of document.getAnimations()) {
        if (seen.has(animation)) continue;
        seen.add(animation);
        if (counted(animation)) window.animationsSeen += 1;
      }
      sample();
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  })()`);
}

export const recordAnimations = (page: Page, counted: string): Promise<void> =>
  install(page, counted, NO_SAMPLING);

export const recordSlides = (page: Page): Promise<void> => install(page, SLIDING, SAMPLING_PANELS);

export const resetAnimations = async (page: Page): Promise<void> => {
  await page.evaluate('(() => { window.animationsSeen = 0; window.tabpanelLefts = {}; })()');
};

export const animationsSeen = async (page: Page): Promise<number> =>
  Number(await page.evaluate('window.animationsSeen'));

export const incomingFrom = async (page: Page): Promise<SlideFrom> => {
  const largest = Number(
    await page.evaluate(`(() => {
      const shown = [...document.querySelectorAll('[role="tabpanel"]')].find(
        (panel) => panel.getClientRects().length > 0,
      );
      const samples = shown === undefined ? [] : window.tabpanelLefts[shown.id] ?? [];
      const resting = samples.at(-1);
      let largest = 0;
      for (const sample of samples) {
        for (const [index, left] of sample.entries()) {
          const offset = left - resting[index];
          if (Math.abs(offset) > Math.abs(largest)) largest = offset;
        }
      }
      return largest;
    })()`),
  );
  if (Math.abs(largest) < SLID_AT_LEAST_PX) return 'none';
  return largest > 0 ? 'right' : 'left';
};
