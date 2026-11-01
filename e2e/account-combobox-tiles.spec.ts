import { expect, test } from '@playwright/test';
import { expectLeftOf, expectTile, typeTile } from './account-type-cues';
import { boxOf, BOOKS_OPEN } from './accounts';
import { ACCOUNTS, entrySearchForm, TYPE_OF } from './entries';
import { accountField, chooseAccount, expectOfferedAccounts, offeredAccount } from './entry-search';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';

test('leads each Account offered by the Account combobox with a tile tinted in its type colour', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(ENTRY_SEARCH_PATH);

  await accountField(page).click();
  await expectOfferedAccounts(page, ACCOUNTS.map((account) => [account, TYPE_OF[account]] as const));
  for (const account of ACCOUNTS) {
    const option = offeredAccount(page, account, TYPE_OF[account]);
    await expectTile(option, TYPE_OF[account]);
    await expectLeftOf(typeTile(option), option.getByText(account, { exact: true }), `${account}'s tile and name`);
  }
});

for (const account of ['Credit card payable', 'Salary'] as const) {
  test(`leads the Account combobox's field with the ${TYPE_OF[account]} tile, tinted in its type colour, once ${account} is chosen`, async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    await page.goto(ENTRY_SEARCH_PATH);
    const form = entrySearchForm(page);
    await expect(accountField(page)).toBeVisible();
    await expect(typeTile(form)).toHaveCount(0);

    await chooseAccount(page, account);

    await expectTile(form, TYPE_OF[account]);
    const field = await boxOf(accountField(page), 'the Account field');
    const tile = await boxOf(typeTile(form), 'the chosen Account tile');
    expect(tile.x).toBeGreaterThanOrEqual(field.x);
    expect(tile.x + tile.width).toBeLessThanOrEqual(field.x + field.width / 2);
    expect(tile.y).toBeGreaterThanOrEqual(field.y);
    expect(tile.y + tile.height).toBeLessThanOrEqual(field.y + field.height);
  });
}
