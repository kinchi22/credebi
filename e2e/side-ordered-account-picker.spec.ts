import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, addGroup, BOOKS_OPEN } from './accounts';
import {
  accountChoice,
  accountChoices,
  accountTick,
  accountTicks,
  ACCOUNTS,
  type AccountType,
  type BalanceDirection,
  chooseAccountButton,
  expectNamesInOrder,
  lineGroup,
  openAccountSheet,
  openEntryForm,
  openTwoLineAccountSheet,
  type PickRole,
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
  Assets: ['Cash', 'Bank deposits'],
  Liabilities: ['Credit card payable'],
  Equity: ['Opening balance equity'],
  Revenue: ['Salary'],
  Expenses: ['Food', 'Transportation', 'Other living expenses', 'Rent', 'Hotels', 'Meals'],
};

const TITLE = 'Groceries';

type Mode = {
  readonly mode: EntryFormMode;
  readonly role: PickRole;
  readonly pickers: (scope: Locator, side: Side) => Locator;
  readonly openSheet: (form: Locator, side: Side) => Promise<Locator>;
  readonly chooseEach: (form: Locator, side: Side) => Promise<void>;
  readonly chooseEachOnSheet: (form: Locator, side: Side) => Promise<void>;
};

async function chooseEachAccount(form: Locator, side: Side): Promise<void> {
  for (const account of ACCOUNTS) {
    const choice = accountChoice(form, side, account);
    await choice.check();
    await expect(choice).toBeChecked();
  }
}

async function chooseEachAccountOnSheet(form: Locator, side: Side): Promise<void> {
  for (const account of ACCOUNTS) {
    const sheet = await openTwoLineAccountSheet(form, side);
    await accountChoice(sheet, side, account).check();
    await form.page().keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(chooseAccountButton(form, side)).toContainText(account);
  }
}

async function expectEveryLine(form: Locator, side: Side): Promise<void> {
  for (const account of ACCOUNTS) {
    await expect(lineGroup(form, side, account)).toBeVisible();
  }
}

async function tickEachAccount(form: Locator, side: Side): Promise<void> {
  for (const account of ACCOUNTS) {
    await accountTick(form, side, account).check();
  }
  await expectEveryLine(form, side);
}

async function tickEachAccountOnSheet(form: Locator, side: Side): Promise<void> {
  const sheet = await openAccountSheet(form, side);
  for (const account of ACCOUNTS) {
    await accountTick(sheet, side, account).check();
  }
  await pressDone(sheet);
  await expectEveryLine(form, side);
}

const MODES: readonly Mode[] = [
  {
    mode: 'Two-line mode',
    role: 'radio',
    pickers: accountChoices,
    openSheet: openTwoLineAccountSheet,
    chooseEach: chooseEachAccount,
    chooseEachOnSheet: chooseEachAccountOnSheet,
  },
  {
    mode: 'Multi-line mode',
    role: 'checkbox',
    pickers: accountTicks,
    openSheet: openAccountSheet,
    chooseEach: tickEachAccount,
    chooseEachOnSheet: tickEachAccountOnSheet,
  },
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

async function expectSideOrder(picker: Locator, side: Side, role: PickRole): Promise<void> {
  await expectNamesInOrder(picker.getByRole('group'), [
    'Suggested',
    ...SIDE_ORDER[side].map((type) => groupName(type, side)),
  ]);
  await expect(suggested(picker)).not.toContainText(/Increase|Decrease/);
  for (const type of SIDE_ORDER[side]) {
    const group = picker.getByRole('group', { name: groupName(type, side), exact: true });
    await expect(group.getByText(BALANCE_DIRECTION[type][side], { exact: true })).toBeVisible();
    await expectNamesInOrder(group.getByRole(role), CHART[type]);
  }
}

for (const { mode, role, pickers, openSheet, chooseEach, chooseEachOnSheet } of MODES) {
  test(`lists the Account types in each Side's order in ${mode}, each Band showing and each group named with its Balance direction for that Side, below a Suggested Band with none, keeping the User's order within a type`, async ({ page }) => {
    test.slow();
    await keepExpensesInUsersOrder(page);
    const form = await openEntryForm(page, mode);
    await titleField(form).fill(TITLE);

    for (const side of SIDES) {
      await expectSideOrder(pickers(form, side), side, role);
    }
  });

  test(`lists the Account types in each Side's order on each tab of the Account sheet at 390px in ${mode}, each Band showing and each group named with its Balance direction for that Side, below a Suggested Band with none, keeping the User's order within a type`, async ({ page }) => {
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

  test(`lets every Account type be chosen on both Sides in ${mode}`, async ({ page }) => {
    await signIn(page);
    const form = await openEntryForm(page, mode);

    for (const side of SIDES) {
      await chooseEach(form, side);
    }
  });

  test(`lets every Account type be chosen on both tabs of the Account sheet at 390px in ${mode}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page);
    const form = await openEntryForm(page, mode);

    for (const side of SIDES) {
      await chooseEachOnSheet(form, side);
    }
  });
}
