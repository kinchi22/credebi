import { expect, type Locator } from '@playwright/test';

export const SCRIM = { x: 4, y: 4 } as const;

export async function selectByDraggingOntoScrim(field: Locator): Promise<void> {
  const box = await field.boundingBox();
  expect(box, 'the field the selection starts in is on screen').not.toBeNull();
  if (box === null) return;
  const page = field.page();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(SCRIM.x, SCRIM.y, { steps: 10 });
  await page.mouse.up();
}
