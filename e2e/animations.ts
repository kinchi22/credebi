import { type Page } from '@playwright/test';

export async function recordAnimations(page: Page, counted: string): Promise<void> {
  await page.evaluate(`(() => {
    window.animationsSeen = 0;
    const counted = ${counted};
    const look = () => {
      window.animationsSeen += document.getAnimations().filter(counted).length;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  })()`);
}

export const resetAnimations = async (page: Page): Promise<void> => {
  await page.evaluate('window.animationsSeen = 0');
};

export const animationsSeen = async (page: Page): Promise<number> =>
  Number(await page.evaluate('window.animationsSeen'));

export const VIEW_TRANSITION_ANIMATION =
  "(animation) => String(animation.effect && animation.effect.pseudoElement).startsWith('::view-transition')";
