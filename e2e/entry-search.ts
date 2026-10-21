import { expect, type Locator, type Page } from '@playwright/test';
import { type AccountType } from './accounts';
import { entrySearchForm, escaped, titleField } from './entries';

export const EARLIEST = '2000-01-01';

export const LATEST = '2099-12-31';

export const results = (page: Page): Locator => page.getByRole('region', { name: 'Results' });

export const resultFor = (page: Page, text: string): Locator =>
  results(page).getByTestId('entry').filter({ hasText: text });

export const fromField = (page: Page): Locator =>
  entrySearchForm(page).getByLabel('From', { exact: true });

export const toField = (page: Page): Locator =>
  entrySearchForm(page).getByLabel('To', { exact: true });

export const accountField = (page: Page): Locator =>
  entrySearchForm(page).getByRole('combobox', { name: 'Account', exact: true });

export const accountList = (page: Page): Locator => page.getByRole('listbox');

export const offeredAccounts = (page: Page): Locator => accountList(page).getByRole('option');

export const offeredAccountName = (name: string, type: AccountType): string => `${name}, ${type}`;

export const offeredAccount = (page: Page, name: string, type: AccountType): Locator =>
  accountList(page).getByRole('option', { name: offeredAccountName(name, type), exact: true });

const offeredAccountNamed = (page: Page, name: string): Locator =>
  accountList(page).getByRole('option', { name: new RegExp(`^${escaped(name)}, `) });

export type OfferedAccount = readonly [name: string, type: AccountType];

export async function expectOfferedAccounts(
  page: Page,
  accounts: readonly OfferedAccount[],
): Promise<void> {
  await expect(offeredAccounts(page)).toHaveCount(accounts.length);
  for (const [index, [name, type]] of accounts.entries()) {
    await expect(offeredAccounts(page).nth(index)).toHaveAccessibleName(offeredAccountName(name, type));
  }
}

export async function chooseAccount(page: Page, name: string): Promise<void> {
  const field = accountField(page);
  await field.click();
  await field.fill(name);
  await offeredAccountNamed(page, name).click();
  await expect(field).toHaveValue(name);
  await expect(accountList(page)).toBeHidden();
}

type Criteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: string;
  readonly title?: string;
  readonly memo?: string;
};

export async function search(page: Page, criteria: Criteria): Promise<void> {
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();

  await fromField(page).fill(criteria.from ?? EARLIEST);
  await toField(page).fill(criteria.to ?? LATEST);
  if (criteria.account !== undefined) {
    await chooseAccount(page, criteria.account);
  }
  if (criteria.title !== undefined) {
    await titleField(form).fill(criteria.title);
  }
  if (criteria.memo !== undefined) {
    await form.getByLabel('Memo', { exact: true }).fill(criteria.memo);
  }

  await form.getByRole('button', { name: 'Search' }).click();
}
