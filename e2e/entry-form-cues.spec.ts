import { expect, test, type Locator } from '@playwright/test';
import { directionArrow, expectDirection, expectLeftOf, expectTile, typeTile } from './account-type-cues';
import { BOOKS_OPEN } from './accounts';
import {
  type Account,
  accountChoice,
  accountTick,
  BALANCE_DIRECTION,
  lineGroup,
  openEntryForm,
  type Side,
  SIDES,
  TYPE_OF,
} from './entries';
import { signIn } from './session';
import { type EntryFormMode } from './settings';

const ONE_OF_EACH_TYPE: readonly Account[] = [
  'Cash',
  'Credit card payable',
  'Opening balance equity',
  'Salary',
  'Food',
];

type Mode = {
  readonly mode: EntryFormMode;
  readonly choose: (form: Locator, side: Side, account: Account) => Promise<void>;
};

const MODES: readonly Mode[] = [
  {
    mode: 'Two-line mode',
    choose: async (form, side, account) => {
      await accountChoice(form, side, account).check();
    },
  },
  {
    mode: 'Multi-line mode',
    choose: async (form, side, account) => {
      await accountTick(form, side, account).check();
    },
  },
];

async function expectChosenCue(form: Locator, side: Side, account: Account): Promise<void> {
  const line = lineGroup(form, side, account);
  const type = TYPE_OF[account];
  await expect(line).toBeVisible();
  await expectTile(line, type);
  const name = line.getByText(account, { exact: true }).filter({ visible: true });
  await expectLeftOf(typeTile(line), name, `${side} ${account}'s tile and name`);
  await expectDirection(line, type, side);
  await expectLeftOf(name, directionArrow(line, BALANCE_DIRECTION[type][side]), `${side} ${account}'s name and direction`);
}

for (const { mode, choose } of MODES) {
  test(`leads each chosen Account in ${mode} with a tile tinted in its type colour and follows it with the Balance direction for its Side, for every Account type on both Sides`, async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, mode);

    for (const account of ONE_OF_EACH_TYPE) {
      for (const side of SIDES) {
        await choose(form, side, account);
        await expectChosenCue(form, side, account);
      }
    }
  });
}
