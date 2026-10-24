import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN, type AccountType } from './accounts';
import {
  accountChoice,
  accountChoices,
  accountTick,
  accountTicks,
  ACCOUNTS,
  type BALANCE_DIRECTIONS,
  chooseAccountButton,
  lineGroup,
  openAccountSheet,
  openEntryForm,
  openTwoLineAccountSheet,
  postEntries,
  pressDone,
  sheetTab,
  SIDES,
  suggested,
  titled,
  titleField,
  type Side,
} from './entries';
import { signIn } from './session';
import { type EntryFormMode } from './settings';
import { PHONE } from './viewport';

type BalanceDirection = (typeof BALANCE_DIRECTIONS)[number];

const SIDE_ORDER: Readonly<Record<Side, readonly AccountType[]>> = {
  Debit: ['Expenses', 'Assets', 'Liabilities', 'Equity', 'Revenue'],
  Credit: ['Assets', 'Liabilities', 'Revenue', 'Equity', 'Expenses'],
};

const BALANCE_DIRECTION: Readonly<Record<AccountType, Readonly<Record<Side, BalanceDirection>>>> = {
  Assets: { Debit: 'Increase', Credit: 'Decrease' },
  Liabilities: { Debit: 'Decrease', Credit: 'Increase' },
  Equity: { Debit: 'Decrease', Credit: 'Increase' },
  Revenue: { Debit: 'Decrease', Credit: 'Increase' },
  Expenses: { Debit: 'Increase', Credit: 'Decrease' },
};

const CHART: Readonly<Record<AccountType, readonly string[]>> = {
  Assets: ['Cash'],
  Liabilities: ['Accounts payable'],
  Equity: ['Capital'],
  Revenue: ['Sales'],
  Expenses: ['Expenses', 'Rent', 'Hotels', 'Meals'],
};

const TITLE = 'Groceries';

type Mode = {
  readonly mode: EntryFormMode;
  readonly role: 'radio' | 'checkbox';
  readonly pickers: (scope: Locator, side: Side) => Locator;
  readonly openSheet: (form: Locator, side: Side) => Promise<Locator>;
};

const MODES: readonly Mode[] = [
  { mode: 'Two-line mode', role: 'radio', pickers: accountChoices, openSheet: openTwoLineAccountSheet },
  { mode: 'Multi-line mode', role: 'checkbox', pickers: accountTicks, openSheet: openAccountSheet },
];

const groupName = (type: AccountType, side: Side): string =>
  `${type}, ${BALANCE_DIRECTION[type][side]}`;

async function keepExpensesInUsersOrder(page: Page): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: 'Rent' });
  await addGroup(page, 'Expenses', { name: 'Travel' });
  await addAccount(page, 'Expenses', { name: 'Meals' });
  await addAccount(page, 'Expenses', { name: 'Hotels', group: 'Travel' });
  await postEntries(page, [titled(TITLE, `${TITLE} ${randomUUID()}`)]);
}

async function expectNamesInOrder(shown: Locator, names: readonly string[]): Promise<void> {
  await expect(shown).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(shown.nth(index)).toHaveAccessibleName(name);
  }
}

async function expectSideOrder(picker: Locator, side: Side, role: Mode['role']): Promise<void> {
  await expectNamesInOrder(picker.getByRole('group'), [
    'Suggested',
    ...SIDE_ORDER[side].map((type) => groupName(type, side)),
  ]);
  await expect(suggested(picker)).not.toContainText(/Increase|Decrease/);
  for (const type of SIDE_ORDER[side]) {
    const group = picker.getByRole('group', { name: groupName(type, side), exact: true });
    await expectNamesInOrder(group.getByRole(role), CHART[type]);
  }
}

for (const { mode, role, pickers, openSheet } of MODES) {
  test(`lists the Account types in each Side's order in ${mode}, each group named with its Balance direction for that Side, after a Suggested group with none, keeping the User's order within a type`, async ({ page }) => {
    test.slow();
    await keepExpensesInUsersOrder(page);
    const form = await openEntryForm(page, mode);
    await titleField(form).fill(TITLE);

    for (const side of SIDES) {
      await expectSideOrder(pickers(form, side), side, role);
    }
  });

  test(`lists the Account types in each Side's order on each tab of the Account sheet at 390px in ${mode}, each group named with its Balance direction for that Side, after a Suggested group with none`, async ({ page }) => {
    test.slow();
    await keepExpensesInUsersOrder(page);
    await page.setViewportSize(PHONE);
    const form = await openEntryForm(page, mode);
    await titleField(form).fill(TITLE);
    const sheet = await openSheet(form, 'Debit');

    for (const side of SIDES) {
      await sheetTab(sheet, side).click();
      await expectSideOrder(pickers(sheet, side), side, role);
    }
  });
}

test('lets every Account type be chosen on both Sides in Two-line mode', async ({ page }) => {
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');

  for (const side of SIDES) {
    for (const account of ACCOUNTS) {
      const choice = accountChoice(form, side, account);
      await choice.check();
      await expect(choice).toBeChecked();
    }
  }
});

test('lets every Account type be chosen on both Sides in Multi-line mode', async ({ page }) => {
  await signIn(page);
  const form = await openEntryForm(page, 'Multi-line mode');

  for (const side of SIDES) {
    for (const account of ACCOUNTS) {
      await accountTick(form, side, account).check();
      await expect(lineGroup(form, side, account)).toBeVisible();
    }
  }
});

test('lets every Account type be chosen on both tabs of the Account sheet at 390px in Two-line mode', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');

  for (const side of SIDES) {
    for (const account of ACCOUNTS) {
      const sheet = await openTwoLineAccountSheet(form, side);
      await accountChoice(sheet, side, account).check();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(chooseAccountButton(form, side)).toContainText(account);
    }
  }
});

test('lets every Account type be chosen on both tabs of the Account sheet at 390px in Multi-line mode', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page);
  const form = await openEntryForm(page, 'Multi-line mode');

  for (const side of SIDES) {
    const sheet = await openAccountSheet(form, side);
    for (const account of ACCOUNTS) {
      await accountTick(sheet, side, account).check();
    }
    await pressDone(sheet);
    for (const account of ACCOUNTS) {
      await expect(lineGroup(form, side, account)).toBeVisible();
    }
  }
});
