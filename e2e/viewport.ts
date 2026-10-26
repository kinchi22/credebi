import { expect, type Locator, type Page, type ViewportSize } from '@playwright/test';

export const PHONE = { width: 390, height: 844 } as const;

export const WIDE = { width: 1280, height: 720 } as const;

export const WIDE_BELOW_SPLIT = { width: 1024, height: 720 } as const;

export function viewportOf(page: Page): ViewportSize {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
  return viewport;
}

export const scrollY = async (page: Page): Promise<number> => Number(await page.evaluate('window.scrollY'));

export const scrollEnd = async (page: Page): Promise<number> =>
  Number(await page.evaluate('document.documentElement.scrollHeight - window.innerHeight'));

export async function expectWithinPhone(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.x ?? Number.NaN).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? Number.NaN) + (box?.width ?? Number.NaN)).toBeLessThanOrEqual(PHONE.width);
  const scrollWidth = Number(await page.evaluate('document.documentElement.scrollWidth'));
  expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);
}

const AT_LEAST_16PX = /^(?:1[6-9]|[2-9]\d|\d{3,})(?:\.\d+)?px$/;

export async function expectTypedWithoutZoom(control: Locator): Promise<void> {
  await expect(control, 'a control smaller than 16px makes iOS Safari zoom in on focus').toHaveCSS(
    'font-size',
    AT_LEAST_16PX,
  );
}
