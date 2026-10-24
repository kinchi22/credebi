import { type Locator, type Page } from '@playwright/test';

export const CATEGORIES = ['Year', 'Quarter', 'Month', 'Relative'] as const;

export type Category = (typeof CATEGORIES)[number];

export async function fixToday(page: Page, day: string): Promise<void> {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00`));
}

export const datePresets = (page: Page): Locator =>
  page.getByRole('group', { name: 'Date presets', exact: true });

export const category = (page: Page, name: Category): Locator =>
  datePresets(page).getByRole('button', { name, exact: true });

export const presetChoice = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

export async function choosePreset(page: Page, within: Category, name: string): Promise<void> {
  await category(page, within).click();
  await presetChoice(page, name).click();
}
