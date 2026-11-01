import { expect, test } from '@playwright/test';
import { expectLeadsTypedText, expectLeftOf, expectTile, typeOf, typeTile } from './account-type-cues';
import { BOOKS_OPEN } from './accounts';
import { ACCOUNTS, entrySearchForm } from './entries';
import { accountField, chooseAccount, expectOfferedAccounts, offeredAccount } from './entry-search';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';

test('leads each Account offered by the Account combobox with a tile tinted in its type colour', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(ENTRY_SEARCH_PATH);

  await accountField(page).click();
  await expectOfferedAccounts(page, ACCOUNTS.map((account) => [account, typeOf(account)] as const));
  for (const account of ACCOUNTS) {
    const option = offeredAccount(page, account, typeOf(account));
    await expectTile(option, typeOf(account));
    await expectLeftOf(typeTile(option).first(), option.getByText(account, { exact: true }), `${account}'s tile and name`);
  }
});

for (const account of ['Credit card payable', 'Salary'] as const) {
  test(`leads the chosen Account's name in the Account combobox's field with the ${typeOf(account)} tile, tinted in its type colour, once ${account} is chosen`, async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    await page.goto(ENTRY_SEARCH_PATH);
    const form = entrySearchForm(page);
    await expect(accountField(page)).toBeVisible();
    await expect(typeTile(form)).toHaveCount(0);

    await chooseAccount(page, account);

    await expectTile(form, typeOf(account));
    await expectLeadsTypedText(typeTile(form).first(), accountField(page), `chosen ${account}`);
  });
}
