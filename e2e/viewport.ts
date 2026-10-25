import { expect, type Locator, type Page } from '@playwright/test';

export const PHONE = { width: 390, height: 844 } as const;

export const WIDE = { width: 1280, height: 720 } as const;

export const WIDE_BELOW_SPLIT = { width: 1024, height: 720 } as const;

export async function expectWithinPhone(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.x ?? Number.NaN).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? Number.NaN) + (box?.width ?? Number.NaN)).toBeLessThanOrEqual(PHONE.width);
  const scrollWidth = Number(await page.evaluate('document.documentElement.scrollWidth'));
  expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);
}
