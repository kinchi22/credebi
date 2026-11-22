import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { dayInBrowser } from './accounts';
import {
  accountChoice,
  accountChoices,
  accountTick,
  addLine,
  entryForm,
  fillHeading,
  lineGroups,
  listedEntry,
  openEntryForm,
  openMultiLineForm,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  titleField,
  twoLine,
} from './entries';
import { BOOKS_OPEN, signIn } from './session';
import { sidebar } from './sidebar';
import { type EntryFormMode } from './settings';

const KEPT_DAY = '2026-11-15';

const MODES: readonly EntryFormMode[] = ['Two-line mode', 'Multi-line mode'];

const dateField = (form: Locator): Locator => form.getByLabel('Date', { exact: true });

const memoOf = (label: string): string => `${label} ${randomUUID()}`;

async function openForm(page: Page, mode: EntryFormMode): Promise<Locator> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  return openEntryForm(page, mode);
}

async function postOn(form: Locator, mode: EntryFormMode, day: string, memo: string): Promise<void> {
  await postHeading(form, mode, day, memo);
  await expect(listedEntry(form.page(), memo)).toHaveCount(1);
  await expect(form.getByLabel('Memo')).toHaveValue('');
}

async function postHeading(form: Locator, mode: EntryFormMode, day: string, memo: string): Promise<void> {
  const heading = { day, title: `Title ${randomUUID().slice(0, 8)}`, memo };
  if (mode === 'Two-line mode') {
    await submitTwoLineEntry(form, twoLine(heading));
    return;
  }
  await submitMultiLineEntry(form, {
    ...heading,
    lines: [
      { side: 'Debit', account: 'Food', amount: '12500' },
      { side: 'Credit', account: 'Cash', amount: '12500' },
    ],
  });
}

async function expectDay(form: Locator, day: string): Promise<void> {
  await expect(dateField(form)).toHaveValue(day);
}

async function expectEmptyApartFromDay(form: Locator, mode: EntryFormMode): Promise<void> {
  await expect(titleField(form)).toHaveValue('');
  await expect(form.getByLabel('Memo')).toHaveValue('');
  if (mode === 'Two-line mode') {
    await expect(form.getByLabel('Amount')).toHaveValue('');
    await expect(accountChoices(form, 'Debit').getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(accountChoices(form, 'Credit').getByRole('radio', { checked: true })).toHaveCount(0);
    return;
  }
  await expect(lineGroups(form)).toHaveCount(0);
}

for (const mode of MODES) {
  test(`keeps the posted day and empties every other input after a saved post in ${mode}`, async ({ page }) => {
    const form = await openForm(page, mode);
    const today = await dayInBrowser(page);
    expect(today).not.toBe(KEPT_DAY);

    await postOn(form, mode, KEPT_DAY, memoOf('First'));

    await expectDay(form, KEPT_DAY);
    await expectEmptyApartFromDay(form, mode);
  });

  test(`posts a following Entry on the kept day without touching the date in ${mode}`, async ({ page }) => {
    const form = await openForm(page, mode);
    await postOn(form, mode, KEPT_DAY, memoOf('First'));
    await expectDay(form, KEPT_DAY);

    const second = memoOf('Second');
    await form.getByLabel('Memo').fill(second);
    if (mode === 'Two-line mode') {
      await accountChoice(form, 'Debit', 'Food').check();
      await accountChoice(form, 'Credit', 'Cash').check();
      await form.getByLabel('Amount').fill('300');
    } else {
      await addLine(form, { side: 'Debit', account: 'Food', amount: '300' });
      await addLine(form, { side: 'Credit', account: 'Cash', amount: '300' });
    }
    await submit(form);

    await expect(listedEntry(page, second)).toHaveCount(1);
    await expect(listedEntry(page, second)).toContainText(KEPT_DAY);
  });
}

test('starts the form on today after a saved post and a reload', async ({ page }) => {
  const form = await openForm(page, 'Two-line mode');
  await postOn(form, 'Two-line mode', KEPT_DAY, memoOf('First'));
  await expectDay(form, KEPT_DAY);

  await page.reload();

  await expectDay(entryForm(page), await dayInBrowser(page));
});

test('starts the form on today after a saved post and a round trip through the Sidebar', async ({ page }) => {
  const form = await openForm(page, 'Two-line mode');
  await postOn(form, 'Two-line mode', KEPT_DAY, memoOf('First'));
  await expectDay(form, KEPT_DAY);

  await sidebar(page).getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await sidebar(page).getByRole('link', { name: 'Entries', exact: true }).click();

  await expect(entryForm(page)).toBeVisible();
  await expectDay(entryForm(page), await dayInBrowser(page));
});

test('starts the form on today when the entries URL is opened directly', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });

  await page.goto('/entries');

  await expectDay(entryForm(page), await dayInBrowser(page));
});

test('keeps every input, the day included, when a post is refused', async ({ page }) => {
  const form = await openMultiLineForm(page);
  const memo = memoOf('Unbalanced');
  const title = `Title ${randomUUID().slice(0, 8)}`;

  await fillHeading(form, { day: KEPT_DAY, title, memo });
  await accountTick(form, 'Debit', 'Food').check();
  await accountTick(form, 'Credit', 'Cash').check();
  await form.getByRole('group', { name: /^Debit Food/ }).getByLabel('Amount').fill('12500');
  await form.getByRole('group', { name: /^Credit Cash/ }).getByLabel('Amount').fill('12000');
  await submit(form);

  await expect(form.getByRole('alert')).toContainText(/balance/i);
  await expectDay(form, KEPT_DAY);
  await expect(titleField(form)).toHaveValue(title);
  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expect(accountTick(form, 'Debit', 'Food')).toBeChecked();
  await expect(accountTick(form, 'Credit', 'Cash')).toBeChecked();
  await expect(form.getByRole('group', { name: /^Debit Food/ }).getByLabel('Amount')).toHaveValue('12500');
  await expect(form.getByRole('group', { name: /^Credit Cash/ }).getByLabel('Amount')).toHaveValue('12000');
});
