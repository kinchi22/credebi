import { expect, type Locator, type Page } from '@playwright/test';
import { closeDialog } from './dialog';
import { accountChoices, type Side } from './entries';

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

export const grips = (scope: Locator | Page): Locator =>
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
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
}

export const NO_GROUP = 'No group';

type Point = { readonly x: number; readonly y: number };

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

const centre = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const bottom = (box: Box): number => box.y + box.height;

async function boxOf(locator: Locator, what: string): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${what} is not on screen`);
  return box;
}

export async function dragTo(page: Page, from: Locator, target: Point): Promise<void> {
  await from.hover();
  const start = centre(await boxOf(from, 'the grip being dragged'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const direction = target.y > start.y ? 1 : -1;
  await page.mouse.move(start.x, start.y + direction * 8, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 24 });
  await page.mouse.up();
}

export async function drag(page: Page, from: Locator, onto: Locator): Promise<void> {
  const start = centre(await boxOf(from, 'the grip being dragged'));
  const end = await boxOf(onto, 'the grip dropped onto');
  const middle = centre(end);
  const direction = middle.y > start.y ? 1 : -1;
  await dragTo(page, from, { x: middle.x, y: middle.y + (direction * end.height) / 4 });
}

const headingRow = (scope: Locator, group: string): Locator =>
  row(scope, group)
    .locator('*')
    .filter({ has: grip(scope.page(), group) })
    .filter({ hasNot: scope.page().getByRole('list') })
    .first();

export async function headingRowMiddle(scope: Locator, group: string): Promise<Point> {
  return centre(await boxOf(headingRow(scope, group), `the heading row of ${group}`));
}

export async function headingRowTopEdge(scope: Locator, group: string): Promise<Point> {
  const heading = await boxOf(headingRow(scope, group), `the heading row of ${group}`);
  return { x: centre(heading).x, y: heading.y + 2 };
}

export async function endOfList(scope: Locator): Promise<Point> {
  const list = await boxOf(scope, 'the Account type');
  const rows = await scope.getByRole('listitem').filter({ has: grips(scope.page()) }).all();
  if (rows.length === 0) throw new Error('the Account type has no rows to drop below');
  const rowsEnd = Math.max(...(await Promise.all(rows.map(async (item) => bottom(await boxOf(item, 'a row'))))));
  const end = bottom(list);
  expect(end - rowsEnd, 'the Account type ends in a drop zone below its rows').toBeGreaterThan(0);
  return { x: centre(list).x, y: (rowsEnd + end) / 2 };
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
