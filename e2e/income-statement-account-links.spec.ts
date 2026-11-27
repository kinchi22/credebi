import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN } from './accounts';
import { statementTable, type StatementTable } from './income-statement';
import { tabTo } from './language';
import { accountLink, reportRow } from './report-tables';
import { INCOME_STATEMENT_PATH as STATEMENT, SETTINGS_PATH } from './routes';
import { signIn } from './session';

type Coloured = {
  readonly ownerDocument: {
    readonly defaultView: { getComputedStyle: (element: Coloured) => { readonly color: string } } | null;
  };
};

type Case = readonly [table: StatementTable, account: string];

const DIRECT: Case = ['Expenses', 'Groceries'];

const GROUPED: Case = ['Revenue', 'Base pay'];

const CASES: readonly Case[] = [DIRECT, GROUPED];

async function signInWithDirectAndGroupedAccounts(page: Page): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  await addAccount(page, 'Expenses', { name: 'Groceries', activeFrom: BOOKS_OPEN });
  await addGroup(page, 'Revenue', { name: 'Pay' });
  await addAccount(page, 'Revenue', { name: 'Base pay', group: 'Pay', activeFrom: BOOKS_OPEN });
  await page.goto(STATEMENT);
}

const headingOf = (page: Page, [table, account]: Case): Locator =>
  reportRow(statementTable(page, table), account).getByRole('rowheader');

const colourOf = (heading: Locator): Promise<string> =>
  heading.evaluate((each: Coloured) => each.ownerDocument.defaultView?.getComputedStyle(each).color ?? '');

test('shows an Account link at rest in the colour of its row heading with no underline, for an Account directly under its Account type and one inside an Account group', async ({ page }) => {
  test.slow();
  await signInWithDirectAndGroupedAccounts(page);

  for (const each of CASES) {
    const link = accountLink(page, ...each);
    await expect(link).toHaveCSS('color', await colourOf(headingOf(page, each)));
    await expect(link).toHaveCSS('text-decoration-line', 'none');
  }
});

test('keeps an Account link in the colour of its row heading with no underline under the pointer and turns the cursor into a pointer', async ({ page }) => {
  test.slow();
  await signInWithDirectAndGroupedAccounts(page);

  for (const each of CASES) {
    const link = accountLink(page, ...each);
    const colour = await colourOf(headingOf(page, each));

    await link.hover();

    await expect(link).toHaveCSS('color', colour);
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    await expect(link).toHaveCSS('cursor', 'pointer');
  }
});

test('shows a visible outline on an Account link focused by Tab', async ({ page }) => {
  test.slow();
  await signInWithDirectAndGroupedAccounts(page);

  for (const each of CASES) {
    const link = accountLink(page, ...each);

    await tabTo(page, link);

    await expect(link.and(page.locator(':focus-visible'))).toBeVisible();
    await expect(link).not.toHaveCSS('outline-style', 'none');
    await expect(link).not.toHaveCSS('outline-width', '0px');
  }
});

test('exposes each Account name as a link, for an Account directly under its Account type and one inside an Account group', async ({ page }) => {
  test.slow();
  await signInWithDirectAndGroupedAccounts(page);

  for (const [table, account] of CASES) {
    await expect(reportRow(statementTable(page, table), account).getByRole('link', { name: account, exact: true })).toHaveCount(1);
  }
});
