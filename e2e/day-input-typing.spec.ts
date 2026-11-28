import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { DAY_FIELDS } from './day-fields';
import {
  caretAt,
  chooseDateOf,
  DAY_PLACEHOLDER,
  expectInsideFrame,
  MAX_DAY_DIGITS,
  placeCaret,
  selectDigits,
} from './day-input';
import { openEntryForm } from './entries';
import { fromField } from './entry-search';
import { reportDate } from './assets-and-liabilities';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';
import { PHONE } from './viewport';

const FILLED = '20261125';

const FORMS = [
  ['compact', '20261125'],
  ['slash', '2026/11/25'],
  ['hyphen', '2026-11-25'],
  ['dot', '2026.11.25'],
] as const;

async function dateField(page: Page): Promise<Locator> {
  return (await openEntryForm(page, 'Two-line mode')).getByLabel('Date', { exact: true });
}

test.beforeEach(async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
});

for (const { name, open } of DAY_FIELDS) {
  test(`keeps only digits, at most eight, as they are typed into ${name}`, async ({ page }) => {
    const field = await open(page);
    await field.fill('');

    await field.pressSequentially('2a0-2/6.1 x1y2z5999');

    await expect(field).toHaveValue(FILLED);
  });

  for (const [form, text] of FORMS) {
    test(`reduces a ${form} date set at once into ${name} to its eight digits`, async ({ page }) => {
      const field = await open(page);

      await field.fill(text);

      await expect(field).toHaveValue(FILLED);
    });
  }

  test(`keeps the first eight digits of a longer value set at once into ${name}`, async ({ page }) => {
    const field = await open(page);

    await field.fill('2026-11-25 and 99');

    await expect(field).toHaveValue(FILLED);
  });

  test(`shows YYYYMMDD in empty ${name}, with a Choose date button inside the field`, async ({ page }) => {
    const field = await open(page);

    await field.fill('');

    await expect(field).toHaveAttribute('placeholder', DAY_PLACEHOLDER);
    await expect(field).not.toHaveAttribute('type', 'date');
    await expectInsideFrame(field, chooseDateOf(field));
  });
}

test('ignores a non-digit keystroke, leaving the digits and the caret where they were', async ({ page }) => {
  const field = await dateField(page);
  await field.fill('2026');
  await placeCaret(field, 4);

  await page.keyboard.type('x');
  await page.keyboard.type('-');
  await page.keyboard.type(' ');

  await expect(field).toHaveValue('2026');
  expect(await caretAt(field)).toEqual([4, 4]);
});

test('ignores a ninth digit typed with no selection, and shows the same eight digits', async ({ page }) => {
  const field = await dateField(page);
  await field.fill(FILLED);
  await field.focus();
  await placeCaret(field, MAX_DAY_DIGITS);

  await page.keyboard.type('9');

  await expect(field).toHaveValue(FILLED);
});

test('replaces the digits a selection covers with the digits typed over it, even when the field is full', async ({ page }) => {
  const field = await dateField(page);
  await field.fill(FILLED);
  await field.focus();

  await selectDigits(field, 0, 4);
  await page.keyboard.type('1999');
  await expect(field).toHaveValue('19991125');

  await selectDigits(field, 4, 6);
  await page.keyboard.type('02');
  await expect(field).toHaveValue('19990225');

  await selectDigits(field, 0, MAX_DAY_DIGITS);
  await page.keyboard.type('20300915');
  await expect(field).toHaveValue('20300915');

  await selectDigits(field, 0, MAX_DAY_DIGITS);
  await page.keyboard.type('2031091599');
  await expect(field).toHaveValue('20310915');
});

test('keeps the caret in place as digits are deleted and inserted in the middle of the field', async ({ page }) => {
  const field = await dateField(page);
  await field.fill(FILLED);
  await field.focus();

  await placeCaret(field, 4);
  await page.keyboard.press('Backspace');
  await expect(field).toHaveValue('2021125');
  expect(await caretAt(field)).toEqual([3, 3]);

  await page.keyboard.type('6');
  await expect(field).toHaveValue(FILLED);
  expect(await caretAt(field)).toEqual([4, 4]);

  await placeCaret(field, 2);
  await page.keyboard.press('Delete');
  await expect(field).toHaveValue('2061125');
  expect(await caretAt(field)).toEqual([2, 2]);

  await page.keyboard.type('2');
  await expect(field).toHaveValue(FILLED);
  expect(await caretAt(field)).toEqual([3, 3]);

  await placeCaret(field, 6);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(field).toHaveValue('202625');
  expect(await caretAt(field)).toEqual([4, 4]);

  await page.keyboard.type('11');
  await expect(field).toHaveValue(FILLED);
  expect(await caretAt(field)).toEqual([6, 6]);
});

test('reduces a date pasted from the clipboard to its first eight digits', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const field = await dateField(page);

  for (const [, text] of [...FORMS, ['long', '2026-11-25 99'] as const]) {
    await page.evaluate(`navigator.clipboard.writeText(${JSON.stringify(text)})`);
    await field.fill('');
    await field.focus();

    await page.keyboard.press('ControlOrMeta+V');

    await expect(field).toHaveValue(FILLED);
  }
});

test('drops the separators of an unpadded date, keeping only the digits it was given', async ({ page }) => {
  const field = await dateField(page);

  await field.fill('2026-1-5');

  await expect(field).toHaveValue('202615');
});

test('shows the entry form Date, Entry search From and the Assets and liabilities Date as eight digits in the order year, month, day', async ({ page }) => {
  await page.goto(ENTRY_SEARCH_PATH);
  await fromField(page).fill('2026-03-04');
  await expect(fromField(page)).toHaveValue('20260304');

  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await reportDate(page).fill('2026-03-04');
  await expect(reportDate(page)).toHaveValue('20260304');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('requests the numeric keypad for the entry form Date, Entry search From and the Assets and liabilities Date', { tag: '@webkit' }, async ({ page }) => {
    const entryDate = await dateField(page);
    await expect(entryDate).toHaveAttribute('inputmode', 'numeric');

    await page.goto(ENTRY_SEARCH_PATH);
    await expect(fromField(page)).toHaveAttribute('inputmode', 'numeric');

    await page.goto(ASSETS_AND_LIABILITIES_PATH);
    await expect(reportDate(page)).toHaveAttribute('inputmode', 'numeric');
  });

  test('sets the day fields in a font of 16px or more, so that focusing one does not zoom the page', { tag: '@webkit' }, async ({ page }) => {
    const entryDate = await dateField(page);
    await expect(entryDate).toHaveCSS('font-size', /^(?:1[6-9]|[2-9]\d)(?:\.\d+)?px$/);

    await page.goto(ENTRY_SEARCH_PATH);
    await expect(fromField(page)).toHaveCSS('font-size', /^(?:1[6-9]|[2-9]\d)(?:\.\d+)?px$/);
  });
});
