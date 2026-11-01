import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  band,
  directionArrow,
  expectNothingTinted,
  expectTinted,
  SUGGESTED_TINT,
  TYPE_TINT,
} from './account-type-cues';
import { accountType, BOOKS_OPEN, bottom, boxOf } from './accounts';
import { reportTable, showReport } from './assets-and-liabilities';
import {
  accountChoices,
  accountTicks,
  ACCOUNT_TYPES,
  type AccountType,
  BALANCE_DIRECTIONS,
  DAY,
  groupName,
  openAccountSheet,
  openEntryForm,
  openTwoLineAccountSheet,
  postEntries,
  sheetTab,
  type Side,
  SIDES,
  suggested,
  titled,
  titleField,
} from './entries';
import { showStatement, statementTable } from './income-statement';
import { ASSETS_AND_LIABILITIES_PATH, INCOME_STATEMENT_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { type EntryFormMode } from './settings';
import { PHONE } from './viewport';

const MONTH_FIRST = '2026-09-01';

const TITLE = 'Groceries';

const ANY_DIRECTION = new RegExp(BALANCE_DIRECTIONS.join('|'));

const TYPE_ICON_ONLY = 1;

type Picker = {
  readonly mode: EntryFormMode;
  readonly pickers: (scope: Locator, side: Side) => Locator;
  readonly openSheet: (form: Locator, side: Side) => Promise<Locator>;
};

const PICKERS: readonly Picker[] = [
  { mode: 'Two-line mode', pickers: accountChoices, openSheet: openTwoLineAccountSheet },
  { mode: 'Multi-line mode', pickers: accountTicks, openSheet: openAccountSheet },
];

async function openFormWithSuggestions(page: Page, mode: EntryFormMode): Promise<Locator> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled(TITLE, `${TITLE} ${randomUUID()}`)]);
  const form = await openEntryForm(page, mode);
  await titleField(form).fill(TITLE);
  return form;
}

async function expectBandsTinted(picker: Locator, side: Side): Promise<void> {
  await expectTinted(band(suggested(picker)), SUGGESTED_TINT);
  for (const type of ACCOUNT_TYPES) {
    const group = picker.getByRole('group', { name: groupName(type, side), exact: true });
    await expectTinted(band(group), TYPE_TINT[type]);
  }
}

async function expectHeadedByBand(table: Locator, type: AccountType): Promise<void> {
  await expect(table).toBeVisible();
  const shown = band(table);
  await expectTinted(shown, TYPE_TINT[type]);
  await expect(shown).toContainText(type);
  await expect(shown).not.toContainText(ANY_DIRECTION);
  await expect(shown.locator('svg')).toHaveCount(TYPE_ICON_ONLY);
  await expect(directionArrow(shown)).toHaveCount(0);
  const firstRow = table.getByRole('rowheader').first();
  await expect(firstRow).toBeVisible();
  expect(bottom(await boxOf(shown, `the ${type} Band`))).toBeLessThanOrEqual(
    (await boxOf(firstRow, `the first row of ${type}`)).y,
  );
}

async function expectNoBand(table: Locator): Promise<void> {
  await expect(table).toBeVisible();
  await expect(table.getByRole('rowheader').first()).toBeVisible();
  await expect(table.getByTestId('band')).toHaveCount(0);
  await expectNothingTinted(table);
}

for (const { mode, pickers, openSheet } of PICKERS) {
  test(`tints each Account type's Band in its type colour on both Sides in ${mode}, and keeps the Suggested Band's own`, async ({ page }) => {
    const form = await openFormWithSuggestions(page, mode);

    for (const side of SIDES) {
      await expectBandsTinted(pickers(form, side), side);
    }
  });

  test(`tints each Account type's Band in its type colour on each tab of the Account sheet at 390px in ${mode}, and keeps the Suggested Band's own`, async ({ page }) => {
    const form = await openFormWithSuggestions(page, mode);
    await page.setViewportSize(PHONE);
    const sheet = await openSheet(form, 'Debit');

    for (const side of SIDES) {
      await sheetTab(sheet, side).click();
      await expectBandsTinted(pickers(sheet, side), side);
    }
  });
}

test("tints each Account type's Band in the Accounts section in its type colour", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);

  for (const type of ACCOUNT_TYPES) {
    await expectTinted(band(accountType(page, type)), TYPE_TINT[type]);
  }
});

test("heads the Income statement's Revenue and Expenses tables with their types' Bands, tinted and with no Balance direction, and leaves Totals untinted with no Band", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(INCOME_STATEMENT_PATH);
  await showStatement(page, MONTH_FIRST, DAY);

  for (const type of ['Revenue', 'Expenses'] as const) {
    await expectHeadedByBand(statementTable(page, type), type);
  }
  await expectNoBand(statementTable(page, 'Totals'));
});

test("heads Assets and liabilities' Assets and Liabilities tables with their types' Bands, tinted and with no Balance direction, and leaves Totals untinted with no Band", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await showReport(page, DAY);

  for (const type of ['Assets', 'Liabilities'] as const) {
    await expectHeadedByBand(reportTable(page, type), type);
  }
  await expectNoBand(reportTable(page, 'Totals'));
});
