import { expect, type Locator, type Page } from '@playwright/test';

export const SCRIM = { x: 4, y: 4 } as const;

const button = (scope: Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

export const discardDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Discard changes', exact: true });

export async function closeDialog(dialog: Locator): Promise<void> {
  await button(dialog, 'Close').click();
}

export async function clickScrim(page: Page): Promise<void> {
  await page.mouse.click(SCRIM.x, SCRIM.y);
}

export async function keepEditing(dialog: Locator, field: Locator, draft: string): Promise<void> {
  const discard = discardDialog(dialog.page());
  await expect(discard).toBeVisible();
  await button(discard, 'Keep editing').click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(field).toHaveValue(draft);
}

export async function discardChanges(dialog: Locator): Promise<void> {
  const discard = discardDialog(dialog.page());
  await expect(discard).toBeVisible();
  await button(discard, 'Discard').click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeHidden();
}

export async function closeDiscarding(dialog: Locator): Promise<void> {
  await closeDialog(dialog);
  await discardChanges(dialog);
}

export async function selectByDraggingOntoScrim(field: Locator): Promise<void> {
  const box = await field.boundingBox();
  if (box === null) throw new Error('the field the selection starts in is not on screen');
  const page = field.page();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(SCRIM.x, SCRIM.y, { steps: 10 });
  await page.mouse.up();
}
