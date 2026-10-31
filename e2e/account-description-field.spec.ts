import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountsSection,
  accountType,
  boxOf,
  descriptionField,
  type Kind,
  nameField,
  openAdd,
  openEdit,
  row,
} from './accounts';
import { closeDialog, discardChanges } from './dialog';
import { signIn } from './session';
import { PHONE, WIDE } from './viewport';

const SAME_TEXT = 'Everyday spending money';

const DIALOGS: readonly {
  readonly title: string;
  readonly open: (page: Page) => Promise<Locator>;
}[] = [
  { title: 'Add account', open: (page) => openAdd(page, 'Assets', 'account') },
  { title: 'Add group', open: (page) => openAdd(page, 'Assets', 'group') },
  { title: 'Edit account', open: (page) => openEdit(page, 'Assets', 'Cash') },
  { title: 'Edit group', open: (page) => openEdit(page, 'Assets', 'Cash and deposits', 'group' satisfies Kind) },
];

const VIEWPORTS = [
  { at: 'at 390px', size: PHONE },
  { at: 'at 1280px', size: WIDE },
] as const;

const PAST_ROUNDED_CORNERS = 8;

async function shotOf(field: Locator, what: string): Promise<Buffer> {
  await field.blur();
  const box = await boxOf(field, what);
  return field.page().screenshot({
    animations: 'disabled',
    caret: 'hide',
    clip: {
      x: box.x + PAST_ROUNDED_CORNERS,
      y: box.y,
      width: box.width - 2 * PAST_ROUNDED_CORNERS,
      height: box.height,
    },
  });
}

async function expectDrawnAlike(dialog: Locator, what: string): Promise<void> {
  const name = await boxOf(nameField(dialog), 'Name');
  const description = await boxOf(descriptionField(dialog), 'Description');
  expect(description.height, `${what}: Description is as tall as Name`).toBe(name.height);
  expect(description.width, `${what}: Description is as wide as Name`).toBe(name.width);

  const nameShot = await shotOf(nameField(dialog), 'Name');
  const descriptionShot = await shotOf(descriptionField(dialog), 'Description');
  expect(descriptionShot.equals(nameShot), `${what}: Description is drawn as Name is`).toBe(true);
}

for (const { at, size } of VIEWPORTS) {
  test(`draws Description as Name is in Add account, Add group, Edit account and Edit group, empty and holding the same text, ${at}`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(size);
    await page.goto('/settings');
    await expect(accountsSection(page)).toBeVisible();

    for (const { title, open } of DIALOGS) {
      const dialog = await open(page);

      await nameField(dialog).fill('');
      await descriptionField(dialog).fill('');
      await expectDrawnAlike(dialog, `${title}, empty`);

      await nameField(dialog).fill(SAME_TEXT);
      await descriptionField(dialog).fill(SAME_TEXT);
      await expectDrawnAlike(dialog, `${title}, holding the same text`);

      await closeDialog(dialog);
      await discardChanges(dialog);
      await expect(dialog).toBeHidden();
    }
  });
}

test('saves Add account and Add group by Enter in Description, as by Enter in Name', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  await expect(accountsSection(page)).toBeVisible();

  for (const kind of ['account', 'group'] as const) {
    const dialog = await openAdd(page, 'Assets', kind);
    await nameField(dialog).fill(`Entered ${kind}`);
    await descriptionField(dialog).fill(`Saved by Enter in a ${kind}`);
    await descriptionField(dialog).press('Enter');
    await expect(dialog, kind).toBeHidden();

    await expect(row(accountType(page, 'Assets'), `Entered ${kind}`)).toContainText(`Saved by Enter in a ${kind}`);
  }
});
