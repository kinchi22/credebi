import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import { addAccount, BOOKS_OPEN } from './accounts';
import { AMOUNT, DAY, listedEntry, postEntries } from './entries';
import {
  arrowDownTo,
  chooseWithSwitch,
  COPY,
  documentLanguage,
  expectSettingsPageIn,
  expectSignInPageIn,
  expectSwitchMarking,
  LANGUAGE_NAMES,
  languageChoice,
  languageChoices,
  languageSwitch,
  preferLanguages,
  settingsLink,
  signUpIn,
  submitTestSignInInAnyLanguage,
  switchChoice,
  switchChoices,
  switchMenu,
  tabTo,
  type Language,
} from './language';
import { ENTRIES_URL, SIGN_IN_URL } from './routes';
import { freshIdentifier, signIn } from './session';
import { SIGNED_IN_PAGES } from './sidebar';
import { expectWithinPhone, PHONE } from './viewport';

const PREFERRED: readonly { readonly acceptLanguage: string; readonly shown: Language }[] = [
  { acceptLanguage: 'ko-KR,ko;q=0.9', shown: 'ko' },
  { acceptLanguage: 'ja-JP,ja;q=0.9', shown: 'ja' },
  { acceptLanguage: 'fr-CA,fr;q=0.9,ja;q=0.8,ko;q=0.7,en;q=0.6', shown: 'ja' },
  { acceptLanguage: 'de-DE,de;q=0.9,ko-KR;q=0.8,ja;q=0.7', shown: 'ko' },
  { acceptLanguage: 'fr-FR,fr;q=0.9,de;q=0.8', shown: 'en' },
];

for (const { acceptLanguage, shown } of PREFERRED) {
  test(`shows the sign-in page in ${shown} to a browser preferring ${acceptLanguage}`, async ({ page }) => {
    await preferLanguages(page, acceptLanguage);

    await page.goto('/sign-in');

    await expectSignInPageIn(page, shown);
    await expectSwitchMarking(page, shown);
  });
}

async function bottomOf(upper: Locator): Promise<number> {
  const box = await upper.boundingBox();
  expect(box, 'the element above the Language switch has a box').not.toBeNull();
  return (box?.y ?? Number.NaN) + (box?.height ?? Number.NaN);
}

test('lists each Language in itself below the sign-in box, marks the current one, and changes the sign-in page', async ({ page }) => {
  await page.goto('/sign-in');
  await expectSignInPageIn(page, 'en');

  const google = page.getByRole('link', { name: COPY.en.google, exact: true });
  const testSignIn = page.getByRole('form', { name: 'Test sign-in' });
  const above = [await bottomOf(google)];
  if ((await testSignIn.count()) > 0) above.push(await bottomOf(testSignIn));
  await expect(languageSwitch(page, 'en')).toBeVisible();
  const switchBox = await languageSwitch(page, 'en').boundingBox();
  expect(switchBox?.y ?? Number.NaN).toBeGreaterThanOrEqual(Math.max(...above));

  await languageSwitch(page, 'en').click();
  await expect(switchChoices(page)).toHaveText([LANGUAGE_NAMES.en, LANGUAGE_NAMES.ko, LANGUAGE_NAMES.ja]);
  await expect(switchChoice(page, 'en')).toBeChecked();
  await expect(switchChoice(page, 'ko')).not.toBeChecked();
  await expect(switchChoice(page, 'ja')).not.toBeChecked();

  await switchChoice(page, 'ko').click();

  await expect(page).toHaveURL(SIGN_IN_URL);
  await expectSignInPageIn(page, 'ko');
  await languageSwitch(page, 'ko').click();
  await expect(switchChoices(page)).toHaveText([LANGUAGE_NAMES.en, LANGUAGE_NAMES.ko, LANGUAGE_NAMES.ja]);
  await expect(switchChoice(page, 'ko')).toBeChecked();
  await expect(switchChoice(page, 'en')).not.toBeChecked();
});

test('remembers the Language chosen with the switch on the next signed-out page, whatever the browser prefers', async ({ page }) => {
  await page.goto('/sign-in');
  await chooseWithSwitch(page, 'en', 'ja');

  await preferLanguages(page, 'ko-KR,ko;q=0.9');
  await page.goto('/entries');

  await expect(page).toHaveURL(SIGN_IN_URL);
  await expectSignInPageIn(page, 'ja');

  const other = await page.context().newPage();
  await other.goto('/sign-in');
  await expectSignInPageIn(other, 'ja');
});

for (const language of ['ko', 'ja'] as const) {
  test(`gives a User who signs up after choosing ${language} with the switch that Language as their Setting, and starting Accounts named in it`, async ({ page }) => {
    await signUpIn(page, language);

    await page.goto('/settings');

    await expectSettingsPageIn(page, language);
    for (const other of ['en', 'ko', 'ja'] as const) {
      if (other !== language) await expect(languageChoice(page, language, other)).not.toBeChecked();
    }
    const main = page.getByRole('main');
    for (const name of COPY[language].startingAccounts) {
      await expect(main.getByText(name, { exact: true }).first()).toBeVisible();
    }
    for (const name of COPY.en.startingAccounts) {
      await expect(main.getByText(name, { exact: true })).toHaveCount(0);
    }
  });

  test(`shows a signed-in page in ${language}, with the document declaring it`, async ({ page }) => {
    await signUpIn(page, language);

    await page.goto('/settings');

    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await expect(page).toHaveTitle(`${COPY[language].settings} \u00B7 Credebi`);
    await expect(
      page.getByRole('heading', { level: 1, name: COPY[language].settings, exact: true }),
    ).toBeVisible();
    await expect(settingsLink(page, language)).toBeVisible();
    await expect(settingsLink(page, 'en')).toHaveCount(0);
  });
}

test('shows an existing User their own Language over the one the browser last showed, and keeps it on the sign-in page after signing out', async ({ page }) => {
  const identifier = freshIdentifier();
  await signIn(page, { identifier });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).not.toHaveURL(ENTRIES_URL);

  await page.goto('/sign-in');
  await chooseWithSwitch(page, 'en', 'ja');
  await submitTestSignInInAnyLanguage(page, identifier);

  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(documentLanguage(page)).toHaveAttribute('lang', 'en');
  await expect(settingsLink(page, 'en')).toBeVisible();
  await page.goto('/settings');
  await expectSettingsPageIn(page, 'en');

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).not.toHaveURL(ENTRIES_URL);
  await page.goto('/sign-in');

  await expectSignInPageIn(page, 'en');
  await expectSwitchMarking(page, 'en');
});

test('shows a User their own Language on a browser that has never shown it', async ({ page, context }) => {
  const identifier = await signUpIn(page, 'ko');
  await context.clearCookies();
  await preferLanguages(page, 'ja-JP,ja;q=0.9');
  await page.goto('/sign-in');
  await expectSignInPageIn(page, 'ja');

  await submitTestSignInInAnyLanguage(page, identifier);

  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  await page.goto('/settings');
  await expectSettingsPageIn(page, 'ko');
});

test('changes the Language at Settings at once, with no save button and no reload, and every signed-in page follows', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  await expectSettingsPageIn(page, 'en');
  await expect(languageChoices(page, 'en').getByRole('button')).toHaveCount(0);
  await page.evaluate('window.languageUnchangedByReload = true');

  await languageChoice(page, 'en', 'ja').check();

  await expectSettingsPageIn(page, 'ja');
  await expect(languageChoice(page, 'ja', 'en')).not.toBeChecked();
  expect(await page.evaluate('window.languageUnchangedByReload')).toBe(true);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(documentLanguage(page)).toHaveAttribute('lang', 'ja');
    await expect(settingsLink(page, 'ja')).toBeVisible();
    await expect(settingsLink(page, 'en')).toHaveCount(0);
    await expect(languageSwitch(page, 'ja')).toHaveCount(0);
  }

  await page.goto('/settings');
  await expectSettingsPageIn(page, 'ja');
});

test('shows an Account name, Title and memo the User typed the same in every Language', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const account = `Pocket ${suffix}`;
  const title = `Lunch ${suffix}`;
  const memo = `Noodles with Settings ${suffix}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto('/settings');
  await addAccount(page, 'Assets', { name: account, activeFrom: BOOKS_OPEN });
  await postEntries(page, [
    { day: DAY, title, memo, debitAccount: 'Expenses', creditAccount: { added: account }, amount: AMOUNT },
  ]);

  let shown: Language = 'en';
  for (const language of ['ko', 'ja', 'en'] as const) {
    await page.goto('/settings');
    await languageChoice(page, shown, language).check();
    shown = language;
    await expectSettingsPageIn(page, language);
    await expect(page.getByRole('main').getByText(account, { exact: true }).first()).toBeVisible();

    await page.goto('/entries');
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    const entry = listedEntry(page, memo);
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(title);
    await expect(entry).toContainText(memo);
    await expect(entry).toContainText(account);
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('fits the Language switch within the screen and works it by keyboard', async ({ page }) => {
    await page.goto('/sign-in');
    const languages = languageSwitch(page, 'en');
    await expectWithinPhone(page, languages);

    await tabTo(page, languages);
    await page.keyboard.press('Enter');
    await expect(switchMenu(page)).toBeVisible();
    await expectWithinPhone(page, switchMenu(page));
    await arrowDownTo(page, switchChoice(page, 'ja'));
    await page.keyboard.press('Enter');

    await expectSignInPageIn(page, 'ja');
    await expectWithinPhone(page, languageSwitch(page, 'ja'));
  });

  test('fits the Language choice at Settings within the screen and works it by keyboard', async ({ page }) => {
    await signIn(page);
    await page.goto('/settings');
    await expectWithinPhone(page, languageChoices(page, 'en'));

    await tabTo(page, languageChoice(page, 'en', 'en'));
    await page.keyboard.press('ArrowDown');

    await expectSettingsPageIn(page, 'ko');
    await expectWithinPhone(page, languageChoices(page, 'ko'));
  });
});
