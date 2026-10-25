import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAccount, BOOKS_OPEN, bottom, boxOf, dayInBrowser, OLD_WALLET } from './accounts';
import {
  AMOUNT,
  entrySearchForm,
  type LineAccount,
  nameOf,
  postEntries,
  titleField,
  type TwoLineEntry,
} from './entries';
import {
  accountField,
  accountList,
  chooseAccount,
  EARLIEST,
  expectOfferedAccounts,
  fromField,
  LATEST,
  type OfferedAccount,
  offeredAccount,
  offeredAccounts,
  resultFor,
  searchButton,
  toField,
} from './entry-search';
import { expectSettingsPageIn, languageChoice } from './language';
import {
  ENTRY_SEARCH_PATH as SEARCH,
  ENTRY_SEARCH_WITH_QUERY,
  ENTRY_SEARCH_WITHOUT_QUERY,
  queryOf,
  UUID_V7,
} from './routes';
import { signIn, signInKeepingSessionOverHttp } from './session';
import {
  finishComposing,
  HANGUL,
  SHINHAN_CARD,
  STARBUCKS,
  STARBUCKS_INITIALS,
  startComposing,
  SUTABA,
  SUTABA_IN_HIRAGANA,
} from './typed-text';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const STARTING: readonly OfferedAccount[] = [
  ['Cash', 'Assets'],
  ['Accounts payable', 'Liabilities'],
  ['Capital', 'Equity'],
  ['Sales', 'Revenue'],
  ['Expenses', 'Expenses'],
];

const ANY_ACCOUNT = 'Any account';

const NO_ACCOUNT_MATCHES = 'No account matches';

const REFUSAL = 'Choose an account from the list, or clear the field to search every account.';

const PETTY_CASH = 'Petty cash';

const LONG_NAME = 'Wallet saved for holidays and birthdays';

const SEU = '\uC2A4';

const TIEUT = '\u314C';

const KOREAN_SEARCH_FORM = '\uAC70\uB798 \uAC80\uC0C9';

const KOREAN_ACCOUNT = '\uACC4\uC815';

const KOREAN_SEARCH = '\uAC80\uC0C9';

const KOREAN_ASSETS = '\uC790\uC0B0';

const DAY = '2026-06-15';

const paidFrom = (memo: string, creditAccount: LineAccount, day = DAY): TwoLineEntry => ({
  day,
  memo,
  debitAccount: 'Expenses',
  creditAccount,
  amount: AMOUNT,
});

const clearButton = (page: Page): Locator =>
  entrySearchForm(page).getByRole('button', { name: /clear/i });

const noAccountMatches = (page: Page): Locator => page.getByText(NO_ACCOUNT_MATCHES, { exact: true });

const validationMessage = async (field: Locator): Promise<string> =>
  field.evaluate((input: { readonly validationMessage: string }) => input.validationMessage);

const selection = async (field: Locator): Promise<readonly (number | null)[]> =>
  field.evaluate((input: { readonly selectionStart: number | null; readonly selectionEnd: number | null }) => [
    input.selectionStart,
    input.selectionEnd,
  ]);

async function openSearch(page: Page): Promise<Locator> {
  await page.goto(SEARCH);
  await expect(entrySearchForm(page)).toBeVisible();
  await fromField(page).fill(EARLIEST);
  await toField(page).fill(LATEST);
  return accountField(page);
}

async function edgesOf(locator: Locator): Promise<{ readonly top: number; readonly bottom: number }> {
  const box = await locator.boundingBox();
  return box === null ? { top: Number.NaN, bottom: Number.NaN } : { top: Math.round(box.y), bottom: Math.round(bottom(box)) };
}

async function typeAccount(field: Locator, typed: string): Promise<void> {
  await field.click();
  await field.fill(typed);
}

async function expectListed(page: Page, listed: readonly string[], unlisted: readonly string[]): Promise<void> {
  for (const memo of listed) await expect(resultFor(page, memo)).toHaveCount(1);
  for (const memo of unlisted) await expect(resultFor(page, memo)).toHaveCount(0);
}

async function expectAccountRefused(page: Page, field: Locator, typed: string): Promise<void> {
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(typed);
  await expect.poll(() => validationMessage(field)).toBe(REFUSAL);
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
}

async function signInWithPettyCash(page: Page): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: PETTY_CASH, activeFrom: BOOKS_OPEN });
}

test('says Any account in the empty Account field, and lists every Account in the order of the Chart of accounts, each named with its Account type, when it is clicked or an arrow key is pressed in it', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const field = await openSearch(page);

  await expect(field).toHaveValue('');
  await expect(field).toHaveAttribute('placeholder', ANY_ACCOUNT);
  await expect(clearButton(page)).toHaveCount(0);

  await field.click();
  await expectOfferedAccounts(page, STARTING);
  await field.press('Escape');
  await expect(accountList(page)).toBeHidden();

  await field.press('ArrowDown');
  await expectOfferedAccounts(page, STARTING);
});

test('narrows the Accounts to those containing the typed text, ignoring case, and says No account matches when none does', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const field = await openSearch(page);

  await typeAccount(field, 'CA');
  await expectOfferedAccounts(page, [['Cash', 'Assets'], ['Capital', 'Equity']]);
  await expect(noAccountMatches(page)).toHaveCount(0);

  await field.fill('payable');
  await expectOfferedAccounts(page, [['Accounts payable', 'Liabilities']]);

  await field.fill(`absent ${randomUUID()}`);
  await expect(offeredAccounts(page)).toHaveCount(0);
  await expect(noAccountMatches(page)).toBeVisible();
});

test('narrows the Accounts by Korean initials, by a syllable still being composed, and across hiragana and katakana', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: STARBUCKS, activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Liabilities', { name: SHINHAN_CARD, activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Expenses', { name: SUTABA, activeFrom: BOOKS_OPEN });
  const field = await openSearch(page);

  await typeAccount(field, STARBUCKS_INITIALS);
  await expectOfferedAccounts(page, [[STARBUCKS, 'Expenses']]);

  await field.fill(SEU);
  const cdp = await startComposing(page, TIEUT);
  await expect(field).toHaveValue(`${SEU}${TIEUT}`);
  await expectOfferedAccounts(page, [[STARBUCKS, 'Expenses']]);
  await finishComposing(cdp, TIEUT);
  await expect(field).toHaveValue(`${SEU}${TIEUT}`);
  await expectOfferedAccounts(page, [[STARBUCKS, 'Expenses']]);

  await field.fill(SUTABA_IN_HIRAGANA);
  await expectOfferedAccounts(page, [[SUTABA, 'Expenses']]);
});

test('lists an ended Account after the rest, and searches by it once it is chosen', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const fromTheWallet = `From the wallet ${run}`;
  const fromCash = `From cash ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  const inUse = await dayInBrowser(page, -10);
  await addAccount(page, 'Assets', {
    name: nameOf(OLD_WALLET),
    activeFrom: await dayInBrowser(page, -30),
    activeUntil: await dayInBrowser(page, -1),
  });
  await postEntries(page, [
    paidFrom(fromTheWallet, OLD_WALLET, inUse),
    paidFrom(fromCash, 'Cash', inUse),
  ]);

  const field = await openSearch(page);
  await field.click();
  await expectOfferedAccounts(page, [...STARTING, [nameOf(OLD_WALLET), 'Assets']]);

  await offeredAccount(page, nameOf(OLD_WALLET), 'Assets').click();
  await expect(field).toHaveValue(nameOf(OLD_WALLET));
  await searchButton(page).click();
  await expectListed(page, [fromTheWallet], [fromCash]);
});

test('chooses an Account by click, or by the arrow keys and Enter, fills the field with its name, closes the list and searches by it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const paid = `Paid ${run}`;
  const owed = `Owed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [paidFrom(paid, 'Cash'), paidFrom(owed, 'Accounts payable')]);

  const field = await openSearch(page);
  await field.click();
  await offeredAccount(page, 'Cash', 'Assets').click();
  await expect(field).toHaveValue('Cash');
  await expect(accountList(page)).toBeHidden();
  await expect(clearButton(page)).toBeVisible();
  await searchButton(page).click();
  await expectListed(page, [paid], [owed]);

  await typeAccount(field, 'payab');
  await field.press('ArrowDown');
  await expect(offeredAccount(page, 'Accounts payable', 'Liabilities')).toHaveAttribute('aria-selected', 'true');
  await field.press('Enter');
  await expect(field).toHaveValue('Accounts payable');
  await expect(accountList(page)).toBeHidden();
  await searchButton(page).click();
  await expectListed(page, [owed], [paid]);
});

test('searches every Account once the clear button is pressed, or the field is emptied or left with only spaces', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const paid = `Paid ${run}`;
  const owed = `Owed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [paidFrom(paid, 'Cash'), paidFrom(owed, 'Accounts payable')]);

  const field = await openSearch(page);
  await chooseAccount(page, 'Cash');
  await searchButton(page).click();
  await expectListed(page, [paid], [owed]);

  await clearButton(page).click();
  await expect(field).toHaveValue('');
  await expect(clearButton(page)).toHaveCount(0);
  await searchButton(page).click();
  await expectListed(page, [paid, owed], []);
  expect(queryOf(page).get('account') ?? '').toBe('');

  for (const emptied of ['', '   ']) {
    await chooseAccount(page, 'Cash');
    await searchButton(page).click();
    await expectListed(page, [paid], [owed]);

    await typeAccount(field, emptied);
    await searchButton(page).click();
    await expectListed(page, [paid, owed], []);
    expect(queryOf(page).get('account') ?? '').toBe('');
  }
});

test('takes text that is an Account name, ignoring case, as that Account even when others contain it, and text in exactly one name as that Account, showing its full name', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const paid = `Paid ${run}`;
  const petty = `Petty ${run}`;
  const owed = `Owed ${run}`;
  await signInWithPettyCash(page);
  await postEntries(page, [
    paidFrom(paid, 'Cash'),
    paidFrom(petty, { added: PETTY_CASH }),
    paidFrom(owed, 'Accounts payable'),
  ]);

  const field = await openSearch(page);
  await typeAccount(field, 'cash');
  await expectOfferedAccounts(page, [['Cash', 'Assets'], [PETTY_CASH, 'Assets']]);
  await field.press('Tab');
  await expect(field).toHaveValue('Cash');
  await searchButton(page).click();
  await expectListed(page, [paid], [petty, owed]);

  await typeAccount(field, 'payab');
  await field.press('Tab');
  await expect(field).toHaveValue('Accounts payable');
  await searchButton(page).click();
  await expectListed(page, [owed], [paid, petty]);

  await typeAccount(field, 'PETTY');
  await searchButton(page).click();
  await expect(field).toHaveValue(PETTY_CASH);
  await expectListed(page, [petty], [paid, owed]);
});

test('refuses to search by text that matches no Account, or several and none exactly, keeping the text and focusing the field with a message', async ({ page }) => {
  await signInWithPettyCash(page);
  const field = await openSearch(page);

  const typo = `absent ${randomUUID()}`;
  await typeAccount(field, typo);
  await field.press('Tab');
  await expect(field).toHaveValue(typo);
  await searchButton(page).click();
  await expectAccountRefused(page, field, typo);

  await typeAccount(field, 'ca');
  await searchButton(page).click();
  await expectAccountRefused(page, field, 'ca');
});

test('refuses in the Language the app is shown in, and names each Account with its Account type in that Language', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await languageChoice(page, 'en', 'ko').check();
  await expectSettingsPageIn(page, 'ko');

  await page.goto(SEARCH);
  const form = page.getByRole('form', { name: KOREAN_SEARCH_FORM, exact: true });
  const field = form.getByRole('combobox', { name: KOREAN_ACCOUNT, exact: true });
  await field.click();
  await expect(offeredAccounts(page).first()).toHaveAccessibleName(new RegExp(`^Cash\\P{L}+${KOREAN_ASSETS}$`, 'u'));

  await field.fill(`absent ${randomUUID()}`);
  await form.getByRole('button', { name: KOREAN_SEARCH, exact: true }).click();
  await expect(field).toBeFocused();
  await expect.poll(() => validationMessage(field)).toMatch(HANGUL);
  expect(await validationMessage(field)).not.toBe(REFUSAL);
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
});

test('closes the list on Escape keeping the text, and on a second Escape puts back the Account last chosen, or empties the field when none was', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const field = await openSearch(page);

  await typeAccount(field, 'Sal');
  await expect(accountList(page)).toBeVisible();
  await field.press('Escape');
  await expect(accountList(page)).toBeHidden();
  await expect(field).toHaveValue('Sal');
  await field.press('Escape');
  await expect(field).toHaveValue('');

  await chooseAccount(page, 'Cash');
  await field.fill('Acc');
  await expect(accountList(page)).toBeVisible();
  await field.press('Escape');
  await expect(accountList(page)).toBeHidden();
  await expect(field).toHaveValue('Acc');
  await field.press('Escape');
  await expect(field).toHaveValue('Cash');
});

test('selects the chosen Account name when the field is opened, so typing replaces it', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const field = await openSearch(page);

  await chooseAccount(page, 'Cash');
  await entrySearchForm(page).getByRole('heading').click();
  await expect(field).not.toBeFocused();

  await field.click();
  await expect(field).toHaveValue('Cash');
  await expect.poll(() => selection(field)).toEqual([0, 'Cash'.length]);
  await page.keyboard.type('Sal');
  await expect(field).toHaveValue('Sal');
  await expectOfferedAccounts(page, [['Sales', 'Revenue']]);
});

test('chooses no Account, keeps the list open and searches nothing when Enter or Escape is pressed while an Account name is being composed', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const field = await openSearch(page);
  const payable = offeredAccount(page, 'Accounts payable', 'Liabilities');

  await typeAccount(field, 'Acc');
  await expectOfferedAccounts(page, [['Accounts payable', 'Liabilities']]);
  await field.press('ArrowDown');
  await expect(payable).toHaveAttribute('aria-selected', 'true');

  const cdp = await startComposing(page, 'o');
  await expect(field).toHaveValue('Acco');

  for (const key of ['Enter', 'Escape']) {
    await page.keyboard.press(key);
    await expect(accountList(page)).toBeVisible();
    await expect(field).toHaveValue('Acco');
    await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
  }

  await finishComposing(cdp, 'o');
  await expect(field).toHaveValue('Acco');
  await expectOfferedAccounts(page, [['Accounts payable', 'Liabilities']]);
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
});

test('keeps the chosen Account in the URL by its id, and fills the field with its name after a reload or when the URL is opened', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const paid = `Paid ${run}`;
  const owed = `Owed ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [paidFrom(paid, 'Cash'), paidFrom(owed, 'Accounts payable')]);

  await openSearch(page);
  await chooseAccount(page, 'Cash');
  await searchButton(page).click();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
  await expectListed(page, [paid], [owed]);

  const searched = new URL(page.url());
  expect(searched.searchParams.get('account') ?? '').toMatch(UUID_V7);
  expect([...searched.searchParams.values()]).not.toContain('Cash');

  await page.reload();
  await expect(accountField(page)).toHaveValue('Cash');
  await expectListed(page, [paid], [owed]);

  await page.goto(SEARCH);
  await page.goto(searched.toString());
  await expect(accountField(page)).toHaveValue('Cash');
  await expect(clearButton(page)).toBeVisible();
  await expectListed(page, [paid], [owed]);
});

test('opens the list at 390px just below the Account field and as wide as it, wraps a long name within the screen, and searches by the Account chosen from it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const saved = `Saved ${run}`;
  const paid = `Paid ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: LONG_NAME, activeFrom: BOOKS_OPEN });
  await postEntries(page, [paidFrom(saved, { added: LONG_NAME }), paidFrom(paid, 'Cash')]);

  await page.setViewportSize(PHONE);
  const field = await openSearch(page);
  await typeAccount(field, 'wallet');
  await expectOfferedAccounts(page, [[LONG_NAME, 'Assets']]);

  const fieldBox = await boxOf(field, 'the Account field');
  const listBox = await boxOf(accountList(page), 'the Account list');
  expect(listBox.y).toBeGreaterThanOrEqual(bottom(fieldBox) - 1);
  expect(listBox.y).toBeLessThanOrEqual(bottom(fieldBox) + 8);
  expect(listBox.x).toBeCloseTo(fieldBox.x, 0);
  expect(listBox.width).toBeCloseTo(fieldBox.width, 0);
  await expectWithinPhone(page, accountList(page));
  await expectWithinPhone(page, offeredAccount(page, LONG_NAME, 'Assets'));

  await offeredAccount(page, LONG_NAME, 'Assets').click();
  await expect(field).toHaveValue(LONG_NAME);
  await searchButton(page).click();
  await expectListed(page, [saved], [paid]);
});

test('lines the Account field up with the Title field, top and bottom, where the two share a row', { tag: '@webkit' }, async ({ page }) => {
  await page.setViewportSize(WIDE);
  await signInKeepingSessionOverHttp(page);
  await page.goto(SEARCH);

  await expect
    .poll(async () => {
      const account = await edgesOf(accountField(page));
      const title = await edgesOf(titleField(entrySearchForm(page)));
      return { top: title.top - account.top, bottom: title.bottom - account.bottom };
    })
    .toEqual({ top: 0, bottom: 0 });
});

test('leaves the same gap below the Account field as below the Title field where the fields stack at 390px', { tag: '@webkit' }, async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signInKeepingSessionOverHttp(page);
  await page.goto(SEARCH);

  await expect
    .poll(async () => {
      const account = await edgesOf(accountField(page));
      const title = await edgesOf(titleField(entrySearchForm(page)));
      const memo = await edgesOf(entrySearchForm(page).getByLabel('Memo', { exact: true }));
      const belowAccount = title.top - account.bottom;
      return { stacked: belowAccount > 0, gapDifference: belowAccount - (memo.top - title.bottom) };
    })
    .toEqual({ stacked: true, gapDifference: 0 });
});
