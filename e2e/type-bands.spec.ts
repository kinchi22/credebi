import { expect, test, type Locator } from '@playwright/test';
import { band, expectTinted, TYPE_TINT } from './account-type-cues';
import { accountType, BOOKS_OPEN, bottom, boxOf } from './accounts';
import { reportTable, showReport } from './assets-and-liabilities';
import { ACCOUNT_TYPES, type AccountType, BALANCE_DIRECTIONS, DAY } from './entries';
import { showStatement, statementTable } from './income-statement';
import { ASSETS_AND_LIABILITIES_PATH, INCOME_STATEMENT_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';

const MONTH_FIRST = '2026-09-01';

const ANY_DIRECTION = new RegExp(BALANCE_DIRECTIONS.join('|'));

async function expectHeadedByBand(table: Locator, type: AccountType): Promise<void> {
  await expect(table).toBeVisible();
  const shown = band(table);
  await expectTinted(shown, TYPE_TINT[type]);
  await expect(shown).toContainText(type);
  await expect(shown).not.toContainText(ANY_DIRECTION);
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
}

test("tints each Account type's Band in the Accounts section in its type colour", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);

  for (const type of ACCOUNT_TYPES) {
    await expectTinted(band(accountType(page, type)), TYPE_TINT[type]);
  }
});

test("heads the Income statement's Revenue and Expenses tables with their types' Bands, tinted and with no Balance direction, and Totals with none", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(INCOME_STATEMENT_PATH);
  await showStatement(page, MONTH_FIRST, DAY);

  for (const type of ['Revenue', 'Expenses'] as const) {
    await expectHeadedByBand(statementTable(page, type), type);
  }
  await expectNoBand(statementTable(page, 'Totals'));
});

test("heads Assets and liabilities' Assets and Liabilities tables with their types' Bands, tinted and with no Balance direction, and Totals with none", async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await showReport(page, DAY);

  for (const type of ['Assets', 'Liabilities'] as const) {
    await expectHeadedByBand(reportTable(page, type), type);
  }
  await expectNoBand(reportTable(page, 'Totals'));
});
