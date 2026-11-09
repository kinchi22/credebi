import { expect, type Locator, type Page } from '@playwright/test';

export type EntryFormMode = 'Two-line mode' | 'Multi-line mode';

export const entryFormModes = (page: Page): Locator =>
  page.getByRole('group', { name: 'Entry form mode' });

export const entryFormModeChoice = (page: Page, mode: EntryFormMode): Locator =>
  entryFormModes(page).getByRole('radio', { name: mode });

export async function setEntryFormMode(page: Page, mode: EntryFormMode): Promise<void> {
  await page.goto('/settings');
  const choice = entryFormModeChoice(page, mode);
  await expect(choice).toBeVisible();
  if (!(await choice.isChecked())) {
    await choice.check();
    await expect(choice).toBeEnabled();
    await page.reload();
  }
  await expect(choice).toBeChecked();
}

export const connectionsSection = (page: Page): Locator =>
  page.getByRole('region', { name: 'Connections', exact: true });

export const connectionItems = (page: Page, clientName: string): Locator =>
  page.getByRole('listitem').filter({ hasText: clientName });

export const shownOn = (label: string, day: string): RegExp => new RegExp(`${label}\\W*${day}`, 'i');

export const revokeButton = (scope: Locator): Locator =>
  scope.getByRole('button', { name: 'Revoke', exact: true });

export const revokeDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Revoke connection', exact: true });

export async function revokeConnection(item: Locator): Promise<void> {
  await revokeButton(item).click();
  const dialog = revokeDialog(item.page());
  await expect(dialog).toBeVisible();
  await revokeButton(dialog).click();
  await expect(dialog).toBeHidden();
}
