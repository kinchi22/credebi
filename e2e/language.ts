import { expect, type Locator, type Page } from '@playwright/test';
import { ACCOUNTS } from './entries';
import { ENTRIES_URL } from './routes';
import { freshIdentifier } from './session';

export type Language = 'en' | 'ko' | 'ja';

export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  ko: '\uD55C\uAD6D\uC5B4',
  ja: '\u65E5\u672C\u8A9E',
};

export type Copy = {
  readonly language: string;
  readonly signIn: string;
  readonly google: string;
  readonly settings: string;
  readonly startingAccounts: readonly string[];
};

export const COPY: Readonly<Record<Language, Copy>> = {
  en: {
    language: 'Language',
    signIn: 'Sign in',
    google: 'Sign in with Google',
    settings: 'Settings',
    startingAccounts: ACCOUNTS,
  },
  ko: {
    language: '\uC5B8\uC5B4',
    signIn: '\uB85C\uADF8\uC778',
    google: 'Google\uB85C \uB85C\uADF8\uC778',
    settings: '\uC124\uC815',
    startingAccounts: [
      '\uD604\uAE08',
      '\uB9E4\uC785\uCC44\uBB34',
      '\uC790\uBCF8\uAE08',
      '\uB9E4\uCD9C',
      '\uBE44\uC6A9',
    ],
  },
  ja: {
    language: '\u8A00\u8A9E',
    signIn: '\u30ED\u30B0\u30A4\u30F3',
    google: 'Google\u3067\u30ED\u30B0\u30A4\u30F3',
    settings: '\u8A2D\u5B9A',
    startingAccounts: [
      '\u73FE\u91D1',
      '\u8CB7\u639B\u91D1',
      '\u8CC7\u672C\u91D1',
      '\u58F2\u4E0A',
      '\u8CBB\u7528',
    ],
  },
};

const IDENTIFIER_FIELD = 'input[name="identifier"]';

export const documentLanguage = (page: Page): Locator => page.locator('html');

export const languageSwitch = (page: Page, shown: Language): Locator =>
  page.getByRole('button', { name: COPY[shown].language, exact: true });

export const switchMenu = (page: Page): Locator => page.getByRole('menu');

export const switchChoices = (page: Page): Locator => switchMenu(page).getByRole('menuitemradio');

export const switchChoice = (page: Page, language: Language): Locator =>
  switchMenu(page).getByRole('menuitemradio', { name: LANGUAGE_NAMES[language], exact: true });

export const languageChoices = (page: Page, shown: Language): Locator =>
  page.getByRole('group', { name: COPY[shown].language, exact: true });

export const languageChoice = (page: Page, shown: Language, language: Language): Locator =>
  languageChoices(page, shown).getByRole('radio', { name: LANGUAGE_NAMES[language], exact: true });

export const settingsLink = (page: Page, shown: Language): Locator =>
  page.getByRole('link', { name: COPY[shown].settings, exact: true });

export async function preferLanguages(page: Page, acceptLanguage: string): Promise<void> {
  await page.route('**/*', async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'accept-language': acceptLanguage },
    });
  });
}

export async function expectSignInPageIn(page: Page, language: Language): Promise<void> {
  await expect(documentLanguage(page)).toHaveAttribute('lang', language);
  await expect(
    page.getByRole('heading', { level: 1, name: COPY[language].signIn, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: COPY[language].google, exact: true })).toBeVisible();
}

export async function expectSwitchMarking(page: Page, language: Language): Promise<void> {
  await languageSwitch(page, language).click();
  await expect(switchChoice(page, language)).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(switchMenu(page)).toBeHidden();
}

export async function chooseWithSwitch(page: Page, from: Language, to: Language): Promise<void> {
  await languageSwitch(page, from).click();
  await switchChoice(page, to).click();
  await expectSignInPageIn(page, to);
}

export async function submitTestSignInInAnyLanguage(page: Page, identifier: string): Promise<void> {
  const form = page.locator('form').filter({ has: page.locator(IDENTIFIER_FIELD) });
  await form.locator(IDENTIFIER_FIELD).fill(identifier);
  await form.getByRole('button').click();
}

export async function signUpIn(page: Page, language: Language): Promise<string> {
  const identifier = freshIdentifier();
  await page.goto('/sign-in');
  if (language !== 'en') await chooseWithSwitch(page, 'en', language);
  await submitTestSignInInAnyLanguage(page, identifier);
  await expect(page).toHaveURL(ENTRIES_URL);
  return identifier;
}

export async function expectSettingsPageIn(page: Page, language: Language): Promise<void> {
  await expect(documentLanguage(page)).toHaveAttribute('lang', language);
  await expect(
    page.getByRole('heading', { level: 1, name: COPY[language].settings, exact: true }),
  ).toBeVisible();
  await expect(languageChoice(page, language, language)).toBeChecked();
}

export async function tabTo(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  for (let press = 0; press < 60; press += 1) {
    if ((await target.and(page.locator(':focus')).count()) > 0) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

export async function arrowDownTo(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  for (let press = 0; press < 4; press += 1) {
    if ((await target.and(page.locator(':focus')).count()) > 0) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(target).toBeFocused();
}
