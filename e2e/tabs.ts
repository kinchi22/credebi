import { expect, type Locator } from '@playwright/test';

export const tabOf = (root: Locator, name: string): Locator =>
  root.getByRole('tablist').getByRole('tab', { name, exact: true });

export const tabpanelOf = (root: Locator): Locator => root.getByRole('tabpanel');

export async function expectTabSelected(root: Locator, names: readonly string[], shown: string): Promise<void> {
  for (const name of names) {
    await expect(tabOf(root, name)).toHaveAttribute('aria-selected', String(name === shown));
  }
}
