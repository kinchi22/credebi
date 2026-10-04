import { expect, type Locator, type Page } from '@playwright/test';
import { entrySearchForm } from './entries';

const EARLIEST = '2000-01-01';

const LATEST = '2099-12-31';

export const results = (page: Page): Locator => page.getByRole('region', { name: 'Results' });

export const resultFor = (page: Page, memo: string): Locator =>
  results(page).getByTestId('entry').filter({ hasText: memo });

export const fromField = (page: Page): Locator =>
  entrySearchForm(page).getByLabel('From', { exact: true });

export const toField = (page: Page): Locator =>
  entrySearchForm(page).getByLabel('To', { exact: true });

type Criteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: string;
  readonly memo?: string;
};

export async function search(page: Page, criteria: Criteria): Promise<void> {
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();

  await fromField(page).fill(criteria.from ?? EARLIEST);
  await toField(page).fill(criteria.to ?? LATEST);
  if (criteria.account !== undefined) {
    await form.getByLabel('Account', { exact: true }).selectOption(criteria.account);
  }
  if (criteria.memo !== undefined) {
    await form.getByLabel('Memo', { exact: true }).fill(criteria.memo);
  }

  await form.getByRole('button', { name: 'Search' }).click();
}
