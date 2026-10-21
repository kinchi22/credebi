import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  entrySearchForm,
  expectOffered,
  findAnAccount,
  openEntryForm,
  openTwoLineAccountSheet,
  postEntries,
  titleField,
  titled,
} from './entries';
import { EARLIEST, fromField, LATEST, toField } from './entry-search';
import { addAccount, BOOKS_OPEN } from './accounts';
import { ENTRY_SEARCH_PATH as SEARCH } from './routes';
import { signIn } from './session';
import { SHINHAN_CARD, STARBUCKS, STARBUCKS_INITIALS, SUTABA, SUTABA_IN_HIRAGANA } from './typed-text';
import { PHONE } from './viewport';

const SUSHI = '\u3059\u3057';

const KANA_TITLES = [SUTABA, SUSHI, 'Starbucks'] as const;

async function signInWithTitles(page: Page, titles: readonly string[]): Promise<void> {
  const run = randomUUID();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(
    page,
    titles.map((title, index) => titled(title, `Entry ${String(index)} ${run}`)),
  );
}

async function typeTitle(field: Locator, typed: string): Promise<void> {
  await field.click();
  await field.fill(typed);
}

async function openSearchTitle(page: Page): Promise<Locator> {
  await page.goto(SEARCH);
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();
  await fromField(page).fill(EARLIEST);
  await toField(page).fill(LATEST);
  return titleField(form);
}

async function expectNarrowedToStarbucks(picker: Locator): Promise<void> {
  await expect(accountChoices(picker, 'Debit').getByRole('radio')).toHaveCount(1);
  await expect(accountChoice(picker, 'Debit', STARBUCKS)).toBeVisible();
  for (const account of [SHINHAN_CARD, 'Cash', 'Expenses'] as const) {
    await expect(accountChoice(picker, 'Debit', account)).toBeHidden();
  }
}

async function signInWithKoreanAccounts(page: Page): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Expenses', { name: STARBUCKS, activeFrom: BOOKS_OPEN });
  await addAccount(page, 'Liabilities', { name: SHINHAN_CARD, activeFrom: BOOKS_OPEN });
}

test("offers a shown Entry's Title in the entry form's Title when its Korean initials are typed, and no Title without those initials", async ({ page }) => {
  test.slow();
  await signInWithTitles(page, [STARBUCKS, SHINHAN_CARD, 'Starbucks']);

  const form = await openEntryForm(page, 'Two-line mode');
  await typeTitle(titleField(form), STARBUCKS_INITIALS);
  await expectOffered(page, [STARBUCKS]);
});

test('narrows the Accounts to the one whose Korean initials are typed in Find an account', async ({ page }) => {
  await signInWithKoreanAccounts(page);

  const form = await openEntryForm(page, 'Two-line mode');
  await findAnAccount(form).fill(STARBUCKS_INITIALS);
  await expectNarrowedToStarbucks(form);
});

test('narrows the Accounts in Choose accounts at 390px to the one whose Korean initials are typed in Find an account', async ({ page }) => {
  await signInWithKoreanAccounts(page);

  const form = await openEntryForm(page, 'Two-line mode');
  await page.setViewportSize(PHONE);
  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await findAnAccount(sheet).fill(STARBUCKS_INITIALS);
  await expectNarrowedToStarbucks(sheet);
});

test("offers a Title written in katakana in the entry form's Title when it is typed in hiragana", async ({ page }) => {
  test.slow();
  await signInWithTitles(page, KANA_TITLES);

  const form = await openEntryForm(page, 'Two-line mode');
  await typeTitle(titleField(form), SUTABA_IN_HIRAGANA);
  await expectOffered(page, [SUTABA]);
});

test("offers a Title written in katakana in Entry search's Title when it is typed in hiragana", async ({ page }) => {
  test.slow();
  await signInWithTitles(page, KANA_TITLES);

  await typeTitle(await openSearchTitle(page), SUTABA_IN_HIRAGANA);
  await expectOffered(page, [SUTABA]);
});
