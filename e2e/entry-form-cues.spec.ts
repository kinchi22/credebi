import { expect, test, type Locator } from '@playwright/test';
import { expectNameCued, formLineName } from './account-type-cues';
import { BOOKS_OPEN } from './accounts';
import { type Account, accountChoice, accountTick, lineGroup, openEntryForm, type Side } from './entries';
import { signIn } from './session';
import { type EntryFormMode } from './settings';

const ONE_OF_EACH_TYPE: readonly Account[] = [
  'Cash',
  'Credit card payable',
  'Opening balance equity',
  'Salary',
  'Food',
];

const ANOTHER_DEBIT: Account = 'Transportation';

type Mode = {
  readonly mode: EntryFormMode;
  readonly chooseOnDebit: (form: Locator, account: Account) => Promise<void>;
  readonly moveToCredit: (form: Locator, account: Account) => Promise<void>;
  readonly clearCredit: (form: Locator, account: Account) => Promise<void>;
};

const MODES: readonly Mode[] = [
  {
    mode: 'Two-line mode',
    chooseOnDebit: async (form, account) => {
      await accountChoice(form, 'Debit', account).check();
    },
    moveToCredit: async (form, account) => {
      await accountChoice(form, 'Debit', ANOTHER_DEBIT).check();
      await accountChoice(form, 'Credit', account).check();
    },
    clearCredit: async () => {},
  },
  {
    mode: 'Multi-line mode',
    chooseOnDebit: async (form, account) => {
      await accountTick(form, 'Debit', account).check();
    },
    moveToCredit: async (form, account) => {
      await accountTick(form, 'Debit', account).uncheck();
      await accountTick(form, 'Credit', account).check();
    },
    clearCredit: async (form, account) => {
      await accountTick(form, 'Credit', account).uncheck();
      await expect(lineGroup(form, 'Credit', account)).toHaveCount(0);
    },
  },
];

async function expectChosenCue(form: Locator, side: Side, account: Account): Promise<void> {
  const line = form.getByRole('group', { name: formLineName(account, side), exact: true });
  await expect(line).toBeVisible();
  await expectNameCued(line, account);
}

for (const { mode, chooseOnDebit, moveToCredit, clearCredit } of MODES) {
  test(`names each chosen Account in ${mode} by its Side, Account, Account type and Balance direction, leading its name with a tile tinted in its type colour and following it with an arrow, and changes the direction when the Account moves to the other Side, for every Account type`, async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    for (const account of ONE_OF_EACH_TYPE) {
      await chooseOnDebit(form, account);
      await expectChosenCue(form, 'Debit', account);

      await moveToCredit(form, account);
      await expectChosenCue(form, 'Credit', account);
      await expect(lineGroup(form, 'Debit', account)).toHaveCount(0);

      await clearCredit(form, account);
    }
  });
}

