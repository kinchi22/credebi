import { expect, type Locator, type Page } from '@playwright/test';

const main = (page: Page): Locator => page.getByRole('main');

export const busySections = (page: Page): Locator => page.locator('[aria-busy="true"]');

export const loadingMessages = (scope: Page | Locator): Locator => scope.getByRole('status');

export const skeletonBlocks = (section: Locator): Locator => section.locator('[aria-hidden="true"]');

export const tryAgain = (page: Page): Locator => main(page).getByRole('button', { name: 'Try again', exact: true });

export const sectionError = (page: Page): Locator => main(page).getByRole('alert');

const PLACEHOLDER_ROLES = [
  'row',
  'cell',
  'columnheader',
  'rowheader',
  'table',
  'list',
  'listitem',
  'textbox',
  'combobox',
  'button',
  'radio',
  'checkbox',
  'link',
  'img',
  'application',
];

export async function expectOnlyLoadingMessageExposed(section: Locator): Promise<void> {
  await expect(loadingMessages(section)).toHaveCount(1);
  const exposed = (await section.ariaSnapshot()).split('\n').map((line) => line.trim());
  for (const role of PLACEHOLDER_ROLES) {
    expect(
      exposed.filter((line) => line.startsWith(`- ${role}`)),
      `the loading section exposes no ${role}`,
    ).toEqual([]);
  }
}
