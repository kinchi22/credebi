import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountsSection,
  accountType,
  activeFrom,
  activeUntil,
  addGroup,
  chosenGroup,
  dayInBrowser,
  expectInGroup,
  expectOrder,
  expectRefused,
  openAdd,
  openEdit,
  pressSave,
  save,
  type AccountType,
  type Kind,
} from './accounts';
import { clickScrim, closeDialog, discardChanges, discardDialog, keepEditing } from './dialog';
import { initialNames } from './initial-chart';
import { signIn } from './session';
import { expectWithinPhone, PHONE } from './viewport';

const ASSETS = initialNames('Assets');

const EXPENSES = initialNames('Expenses');

const KINDS: readonly Kind[] = ['account', 'group'];

const addAnother = (dialog: Locator): Locator =>
  dialog.getByRole('checkbox', { name: 'Add another', exact: true });

const nameField = (dialog: Locator): Locator => dialog.getByLabel('Name', { exact: true });

const descriptionField = (dialog: Locator): Locator =>
  dialog.getByLabel('Description', { exact: true });

const saveButton = (dialog: Locator): Locator =>
  dialog.getByRole('button', { name: 'Save', exact: true });

const confirmation = (dialog: Locator): Locator => dialog.getByRole('status');

const added = (name: string): string => `${name} was added.`;

async function openSettings(page: Page): Promise<void> {
  await signIn(page);
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();
}

async function saveKeepingOpen(dialog: Locator, name: string): Promise<void> {
  await nameField(dialog).fill(name);
  await pressSave(dialog);
  await expect(confirmation(dialog)).toHaveText(added(name));
  await expect(dialog).toBeVisible();
}

async function openKeepingOpen(page: Page, type: AccountType, kind: Kind): Promise<Locator> {
  const dialog = await openAdd(page, type, kind);
  await expect(addAnother(dialog)).not.toBeChecked();
  await addAnother(dialog).check();
  return dialog;
}

const FAR_ACTIVE_UNTIL = '2099-12-31';

async function openKeepingOpenAwayFromDefaults(page: Page, kind: Kind): Promise<Locator> {
  const dialog = await openKeepingOpen(page, 'Assets', kind);
  if (kind === 'account') await activeUntil(dialog).fill(FAR_ACTIVE_UNTIL);
  return dialog;
}

async function boxOf(locator: Locator, what: string): Promise<{ x: number; y: number; width: number; height: number }> {
  await expect(locator, what).toBeVisible();
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${what} is not on screen`);
  return box;
}

async function expectStartOfLastRow(dialog: Locator): Promise<void> {
  const checkbox = await boxOf(addAnother(dialog), 'Add another');
  const button = await boxOf(saveButton(dialog), 'Save');
  expect(checkbox.x + checkbox.width, 'Add another stands before Save').toBeLessThan(button.x);
  expect(checkbox.y, 'Add another shares the row of Save').toBeLessThan(button.y + button.height);
  expect(button.y, 'Save shares the row of Add another').toBeLessThan(checkbox.y + checkbox.height);
  const fields = await boxOf(descriptionField(dialog), 'Description');
  expect(checkbox.y, 'Add another is below the form').toBeGreaterThan(fields.y + fields.height);
}

test('shows Add another unchecked at the start of the last row of Add account and Add group, and closes the dialog on Save while it is unchecked', async ({ page }) => {
  await openSettings(page);

  for (const kind of KINDS) {
    const dialog = await openAdd(page, 'Assets', kind);
    await expect(addAnother(dialog), kind).not.toBeChecked();
    await expectStartOfLastRow(dialog);
    await nameField(dialog).fill(`Unchecked ${kind}`);
    await save(dialog);
  }

  const toggled = await openAdd(page, 'Assets', 'account');
  await addAnother(toggled).check();
  await addAnother(toggled).uncheck();
  await nameField(toggled).fill('Toggled account');
  await save(toggled);

  await expectOrder(accountType(page, 'Assets'), [
    ...ASSETS,
    'Unchecked account',
    'Unchecked group',
    'Toggled account',
  ]);
});

test('keeps Add account open on Save while Add another is checked, emptying Name and Description, keeping Group and the Active period, and lists the Account in its Group', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Assets', { name: 'Bank' });
  const from = await dayInBrowser(page, -10);
  const until = await dayInBrowser(page, 30);

  const dialog = await openKeepingOpen(page, 'Assets', 'account');
  await descriptionField(dialog).fill('Salary goes here');
  await dialog.getByLabel('Group', { exact: true }).selectOption({ label: 'Bank' });
  await activeFrom(dialog).fill(from);
  await activeUntil(dialog).fill(until);
  await saveKeepingOpen(dialog, 'ABC Bank');

  await expect(dialog.getByRole('heading', { name: 'Add account', exact: true })).toBeVisible();
  await expect(dialog.getByText('Assets', { exact: true })).toBeVisible();
  await expect(nameField(dialog)).toHaveValue('');
  await expect(descriptionField(dialog)).toHaveValue('');
  await expect(chosenGroup(dialog)).toHaveText('Bank');
  await expect(activeFrom(dialog)).toHaveValue(from);
  await expect(activeUntil(dialog)).toHaveValue(until);
  await expect(nameField(dialog)).toBeFocused();
  await expect(addAnother(dialog)).toBeChecked();
  await expectOrder(accountType(page, 'Assets'), [...ASSETS, 'Bank', 'ABC Bank']);

  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
  await expectInGroup(page, 'Assets', 'ABC Bank', 'Bank');
});

test('lists both Accounts after two kept-open saves in Add account, and shows only the second confirmation', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Liabilities', { name: 'Cards' });

  const dialog = await openKeepingOpen(page, 'Liabilities', 'account');
  await dialog.getByLabel('Group', { exact: true }).selectOption({ label: 'Cards' });
  await saveKeepingOpen(dialog, 'Visa');
  await saveKeepingOpen(dialog, 'Mastercard');

  await expect(confirmation(dialog)).toHaveText(added('Mastercard'));
  await expect(dialog.getByText(added('Visa'))).toHaveCount(0);
  await expectOrder(accountType(page, 'Liabilities'), ['Credit card payable', 'Cards', 'Visa', 'Mastercard']);

  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
  await expectInGroup(page, 'Liabilities', 'Visa', 'Cards');
  await expectInGroup(page, 'Liabilities', 'Mastercard', 'Cards');
});

test('keeps Add group open on Save while Add another is checked, emptying Name and Description, and lists the group under its Account type', async ({ page }) => {
  await openSettings(page);

  const dialog = await openKeepingOpen(page, 'Expenses', 'group');
  await descriptionField(dialog).fill('Trips away');
  await saveKeepingOpen(dialog, 'Travel');

  await expect(dialog.getByRole('heading', { name: 'Add group', exact: true })).toBeVisible();
  await expect(nameField(dialog)).toHaveValue('');
  await expect(descriptionField(dialog)).toHaveValue('');
  await expect(nameField(dialog)).toBeFocused();
  await expect(addAnother(dialog)).toBeChecked();
  await expectOrder(accountType(page, 'Expenses'), [...EXPENSES, 'Travel']);

  await saveKeepingOpen(dialog, 'Office');
  await expect(dialog.getByText(added('Travel'))).toHaveCount(0);
  await expectOrder(accountType(page, 'Expenses'), [...EXPENSES, 'Travel', 'Office']);
});

test('shows a refusal in place of the confirmation when a save after a kept-open save is refused, and keeps the typed input', async ({ page }) => {
  await openSettings(page);

  for (const kind of KINDS) {
    const dialog = await openKeepingOpen(page, 'Assets', kind);
    const first = `First ${kind}`;
    await saveKeepingOpen(dialog, first);

    await nameField(dialog).fill(first.toUpperCase());
    await descriptionField(dialog).fill('Typed after the save');
    await pressSave(dialog);

    await expectRefused(dialog);
    await expect(dialog.getByText(added(first)), kind).toHaveCount(0);
    await expect(nameField(dialog)).toHaveValue(first.toUpperCase());
    await expect(descriptionField(dialog)).toHaveValue('Typed after the save');
    await expect(addAnother(dialog)).toBeChecked();

    await closeDialog(dialog);
    await discardChanges(dialog);
  }

  await expectOrder(accountType(page, 'Assets'), [...ASSETS, 'First account', 'First group']);
});

const CLOSERS: readonly { readonly how: string; readonly close: (dialog: Locator) => Promise<void> }[] = [
  { how: 'Close', close: closeDialog },
  { how: 'Escape', close: (dialog) => dialog.page().keyboard.press('Escape') },
  { how: 'scrim', close: (dialog) => clickScrim(dialog.page()) },
];

test('closes Add account and Add group at once by Close, Escape or a click on the scrim right after a kept-open save', async ({ page }) => {
  test.slow();
  await openSettings(page);
  const names: string[] = [];

  for (const kind of KINDS) {
    for (const { how, close } of CLOSERS) {
      const name = `${kind} closed by ${how}`;
      const dialog = await openKeepingOpenAwayFromDefaults(page, kind);
      await saveKeepingOpen(dialog, name);
      names.push(name);

      await close(dialog);
      await expect(dialog, name).toBeHidden();
      await expect(discardDialog(page)).toHaveCount(0);
    }
  }

  await expectOrder(accountType(page, 'Assets'), [...ASSETS, ...names]);
});

test('asks Discard changes when a name is typed after a kept-open save, and not when only Add another is toggled', async ({ page }) => {
  await openSettings(page);

  for (const kind of KINDS) {
    const typed = await openKeepingOpenAwayFromDefaults(page, kind);
    await saveKeepingOpen(typed, `Saved ${kind}`);
    await nameField(typed).fill(`Draft ${kind}`);
    await closeDialog(typed);
    await keepEditing(typed, nameField(typed), `Draft ${kind}`);
    await page.keyboard.press('Escape');
    await discardChanges(typed);

    const toggledAfterSave = await openKeepingOpenAwayFromDefaults(page, kind);
    await saveKeepingOpen(toggledAfterSave, `Toggled ${kind}`);
    await addAnother(toggledAfterSave).uncheck();
    await closeDialog(toggledAfterSave);
    await expect(toggledAfterSave, kind).toBeHidden();
    await expect(discardDialog(page)).toHaveCount(0);

    const toggledOnly = await openKeepingOpen(page, 'Assets', kind);
    await clickScrim(page);
    await expect(toggledOnly, kind).toBeHidden();
    await expect(discardDialog(page)).toHaveCount(0);
  }

  await expectOrder(accountType(page, 'Assets'), [
    ...ASSETS,
    'Saved account',
    'Toggled account',
    'Saved group',
    'Toggled group',
  ]);
});

test('reopens Add account and Add group with Add another unchecked and no confirmation', async ({ page }) => {
  await openSettings(page);

  for (const kind of KINDS) {
    const name = `Reopened ${kind}`;
    const dialog = await openKeepingOpen(page, 'Revenue', kind);
    await saveKeepingOpen(dialog, name);
    await closeDialog(dialog);
    await expect(dialog).toBeHidden();

    const reopened = await openAdd(page, 'Revenue', kind);
    await expect(addAnother(reopened), kind).not.toBeChecked();
    await expect(reopened.getByText(added(name))).toHaveCount(0);
    await expect(reopened.getByText(/ was added\.$/)).toHaveCount(0);
    await nameField(reopened).fill(`Single ${kind}`);
    await save(reopened);
  }

  await expectOrder(accountType(page, 'Revenue'), [
    'Salary',
    'Reopened account',
    'Single account',
    'Reopened group',
    'Single group',
  ]);
});

test('shows no Add another in Edit account or Edit group', async ({ page }) => {
  await openSettings(page);
  await addGroup(page, 'Assets', { name: 'Bank' });

  const account = await openEdit(page, 'Assets', 'Cash');
  await expect(saveButton(account)).toBeVisible();
  await expect(addAnother(account)).toHaveCount(0);
  await expect(account.getByText('Add another', { exact: true })).toHaveCount(0);
  await closeDialog(account);
  await expect(account).toBeHidden();

  const group = await openEdit(page, 'Assets', 'Bank', 'group');
  await expect(saveButton(group)).toBeVisible();
  await expect(addAnother(group)).toHaveCount(0);
  await expect(group.getByText('Add another', { exact: true })).toHaveCount(0);
});

test('fits the last row of Add account and Add group, Add another and Save, within 390px, also after a kept-open save', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();

  for (const kind of KINDS) {
    const dialog = await openAdd(page, 'Assets', kind);
    await expect(addAnother(dialog)).toBeVisible();
    await expectWithinPhone(page, addAnother(dialog));
    await expectWithinPhone(page, saveButton(dialog));
    await expectStartOfLastRow(dialog);

    await addAnother(dialog).check();
    await saveKeepingOpen(dialog, `Phone ${kind}`);
    await expect(confirmation(dialog)).toBeVisible();
    await expectWithinPhone(page, addAnother(dialog));
    await expectWithinPhone(page, saveButton(dialog));
    await expectWithinPhone(page, confirmation(dialog));
    await expectStartOfLastRow(dialog);

    await closeDialog(dialog);
    await expect(dialog).toBeHidden();
  }

  await expectOrder(accountType(page, 'Assets'), [...ASSETS, 'Phone account', 'Phone group']);
});
