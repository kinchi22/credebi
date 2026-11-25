import { type Page } from '@playwright/test';

export type Side = 'right' | 'left' | 'none';

const SLID_AT_LEAST_PX = 8;

export async function recordAnimations(page: Page, counted: string): Promise<void> {
  await page.evaluate(`(() => {
    window.animationsSeen = 0;
    window.tabpanelLefts = [];
    const counted = ${counted};
    const left = (element) => (element === null ? Number.NaN : element.getBoundingClientRect().left);
    const look = () => {
      window.animationsSeen += document.getAnimations().filter(counted).length;
      for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
        if (panel.getClientRects().length === 0) continue;
        window.tabpanelLefts.push([left(panel), left(panel.firstElementChild)]);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  })()`);
}

export const resetAnimations = async (page: Page): Promise<void> => {
  await page.evaluate('(() => { window.animationsSeen = 0; window.tabpanelLefts = []; })()');
};

export const animationsSeen = async (page: Page): Promise<number> =>
  Number(await page.evaluate('window.animationsSeen'));

export const incomingFrom = async (page: Page): Promise<Side> => {
  const largest = Number(
    await page.evaluate(`(() => {
      const samples = window.tabpanelLefts;
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

export const VIEW_TRANSITION_ANIMATION =
  "(animation) => String(animation.effect && animation.effect.pseudoElement).startsWith('::view-transition')";
