import { expect, type Locator, type Page } from '@playwright/test';
import { accountChoices, ACCOUNTS, type Side } from './entries';

export const ACCOUNT_TYPES = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Kind = 'account' | 'group';

export type AccountFields = {
  readonly name?: string;
  readonly description?: string;
  readonly group?: string;
  readonly activeFrom?: string;
  readonly activeUntil?: string;
};

export type GroupFields = {
  readonly name?: string;
  readonly description?: string;
};

export const accountsSection = (page: Page): Locator =>
  page.getByRole('region', { name: 'Accounts', exact: true });

export const accountType = (page: Page, type: AccountType): Locator =>
  accountsSection(page).getByRole('group', { name: type, exact: true });

export const showEndedAccounts = (page: Page): Locator =>
  accountsSection(page).getByRole('checkbox', { name: 'Show ended accounts', exact: true });

export const grip = (scope: Locator | Page, name: string): Locator =>
  scope.getByRole('button', { name: `Move ${name}`, exact: true });

export const grips = (scope: Locator): Locator =>
  scope.getByRole('button', { name: /^Move / });

export const row = (scope: Locator, name: string): Locator =>
  scope.getByRole('listitem').filter({ has: grip(scope.page(), name) }).last();

const button = (scope: Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

const rowButton = (scope: Locator, name: string, action: 'Edit' | 'Delete'): Locator =>
  button(row(scope, name), action).first();

const dialogNamed = (page: Page, name: string): Locator =>
  page.getByRole('dialog', { name, exact: true });

const addDialog = (page: Page, kind: Kind): Locator =>
  dialogNamed(page, `Add ${kind}`);

const editDialog = (page: Page, kind: Kind): Locator =>
  dialogNamed(page, `Edit ${kind}`);

const deleteDialog = (page: Page, kind: Kind): Locator =>
  dialogNamed(page, `Delete ${kind}`);

const groupField = (dialog: Locator): Locator => dialog.getByLabel('Group', { exact: true });

const chosenGroup = (dialog: Locator): Locator => groupField(dialog).locator('option:checked');

export const activeFrom = (dialog: Locator): Locator =>
  dialog.getByLabel('Active from', { exact: true });

export const activeUntil = (dialog: Locator): Locator =>
  dialog.getByLabel('Active until', { exact: true });

async function fill(dialog: Locator, fields: AccountFields): Promise<void> {
  if (fields.name !== undefined) await dialog.getByLabel('Name', { exact: true }).fill(fields.name);
  if (fields.description !== undefined) {
    await dialog.getByLabel('Description', { exact: true }).fill(fields.description);
  }
  if (fields.group !== undefined) await groupField(dialog).selectOption({ label: fields.group });
  if (fields.activeFrom !== undefined) await activeFrom(dialog).fill(fields.activeFrom);
  if (fields.activeUntil !== undefined) await activeUntil(dialog).fill(fields.activeUntil);
}

export async function openAdd(page: Page, type: AccountType, kind: Kind): Promise<Locator> {
  await button(accountType(page, type), `Add ${kind}`).click();
  const dialog = addDialog(page, kind);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function pressSave(dialog: Locator): Promise<void> {
  await button(dialog, 'Save').click();
}

export async function save(dialog: Locator): Promise<void> {
  await pressSave(dialog);
  await expect(dialog).toBeHidden();
}

export async function expectRefused(dialog: Locator): Promise<void> {
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).toBeVisible();
}

export async function addAccount(
  page: Page,
  type: AccountType,
  fields: AccountFields & { readonly name: string },
): Promise<void> {
  const dialog = await openAdd(page, type, 'account');
  await fill(dialog, fields);
  await save(dialog);
}

export async function addGroup(
  page: Page,
  type: AccountType,
  fields: GroupFields & { readonly name: string },
): Promise<void> {
  const dialog = await openAdd(page, type, 'group');
  await fill(dialog, fields);
  await save(dialog);
}

export async function openEdit(
  page: Page,
  type: AccountType,
  name: string,
  kind: Kind = 'account',
): Promise<Locator> {
  await rowButton(accountType(page, type), name, 'Edit').click();
  const dialog = editDialog(page, kind);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function editAccount(
  page: Page,
  type: AccountType,
  name: string,
  fields: AccountFields,
): Promise<void> {
  const dialog = await openEdit(page, type, name);
  await fill(dialog, fields);
  await save(dialog);
}

export async function openDelete(
  page: Page,
  type: AccountType,
  name: string,
  kind: Kind = 'account',
): Promise<Locator> {
  await rowButton(accountType(page, type), name, 'Delete').click();
  const dialog = deleteDialog(page, kind);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function confirmDelete(dialog: Locator): Promise<void> {
  await button(dialog, 'Delete').click();
}

export async function expectOrder(scope: Locator, names: readonly string[]): Promise<void> {
  await expect(grips(scope)).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(grips(scope).nth(index)).toHaveAccessibleName(`Move ${name}`);
  }
}

export async function expectInGroup(
  page: Page,
  type: AccountType,
  name: string,
  group: string,
): Promise<void> {
  const dialog = await openEdit(page, type, name);
  await expect(chosenGroup(dialog)).toHaveText(group);
  await button(dialog, 'Cancel').click();
  await expect(dialog).toBeHidden();
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

export async function drag(page: Page, from: Locator, onto: Locator): Promise<void> {
  await from.hover();
  const start = await from.boundingBox();
  const end = await onto.boundingBox();
  expect(start, 'the grip being dragged is on screen').not.toBeNull();
  expect(end, 'the grip dropped onto is on screen').not.toBeNull();
  if (start === null || end === null) return;
  const a = centre(start);
  const b = centre(end);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const direction = b.y > a.y ? 1 : -1;
  await page.mouse.move(a.x, a.y + direction * 8, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 20 });
  await page.mouse.move(b.x, b.y + (direction * end.height) / 4, { steps: 4 });
  await page.mouse.up();
}

export async function dayInBrowser(page: Page, daysFromToday = 0): Promise<string> {
  return page.evaluate((offset) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const two = (value: number): string => String(value).padStart(2, '0');
    return `${String(day.getFullYear()).padStart(4, '0')}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
  }, daysFromToday);
}

export const offeredType = (form: Locator, side: Side, type: AccountType): Locator =>
  accountChoices(form, side).getByRole('group', { name: type, exact: true });

export const BOOKS_OPEN = '2000-01-01';

export async function startAccountsOn(page: Page, day = BOOKS_OPEN): Promise<void> {
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();
  for (const [index, type] of ACCOUNT_TYPES.entries()) {
    await editAccount(page, type, ACCOUNTS[index] ?? '', { activeFrom: day });
  }
}
