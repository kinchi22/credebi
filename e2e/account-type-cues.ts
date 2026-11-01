import { expect, type Locator } from '@playwright/test';
import { boxOf } from './accounts';
import {
  type Account,
  type AccountType,
  BALANCE_DIRECTION,
  BALANCE_DIRECTIONS,
  type BalanceDirection,
  type Side,
  TYPE_OF,
} from './entries';
import { CATALOGUE, type Language } from './language';

export const TYPE_TINT: Readonly<Record<AccountType, string>> = {
  Assets: 'rgb(236, 229, 225)',
  Liabilities: 'rgb(231, 227, 245)',
  Equity: 'rgb(219, 233, 238)',
  Revenue: 'rgb(229, 236, 217)',
  Expenses: 'rgb(242, 224, 233)',
};

export const SUGGESTED_TINT = 'rgb(220, 240, 233)';

export const band = (scope: Locator): Locator => scope.getByTestId('band').filter({ visible: true });

export const typeTile = (scope: Locator): Locator =>
  scope.getByTestId('type-tile').filter({ visible: true });

export const directionArrow = (scope: Locator, direction: BalanceDirection): Locator =>
  scope.getByRole('img', { name: direction, exact: true }).filter({ visible: true });

export const entryLineName = (account: Account, side: Side, shown: Language = 'en'): string => {
  const type = TYPE_OF[account];
  const text = CATALOGUE[shown];
  return `${account}, ${text.accounts.types[type]}, ${text.directions[BALANCE_DIRECTION[type][side]]}`;
};

export async function expectTinted(shown: Locator, tint: string): Promise<void> {
  await expect(shown).toHaveCount(1);
  await expect(shown).toBeVisible();
  await expect(shown).toHaveCSS('background-color', tint);
}

export async function expectTile(scope: Locator, type: AccountType): Promise<void> {
  await expectTinted(typeTile(scope), TYPE_TINT[type]);
}

export async function expectLeftOf(first: Locator, then: Locator, what: string): Promise<void> {
  await expect(first).toBeVisible();
  await expect(then).toBeVisible();
  const left = await boxOf(first, `the ${what} that comes first`);
  const right = await boxOf(then, `the ${what} that follows`);
  expect(left.x + left.width, `${what}: the first ends before the second starts`).toBeLessThanOrEqual(right.x);
}

export async function expectDirection(scope: Locator, type: AccountType, side: Side): Promise<void> {
  const shown = BALANCE_DIRECTION[type][side];
  await expect(directionArrow(scope, shown)).toHaveCount(1);
  for (const other of BALANCE_DIRECTIONS.filter((direction) => direction !== shown)) {
    await expect(directionArrow(scope, other)).toHaveCount(0);
  }
}
