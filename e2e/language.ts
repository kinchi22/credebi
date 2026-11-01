import { expect, type Locator, type Page } from '@playwright/test';
import { type AccountType, type BalanceDirection } from './entries';
import { ENTRIES_URL } from './routes';
import { freshIdentifier } from './session';

export type Language = 'en' | 'ko' | 'ja';

export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  ko: '\uD55C\uAD6D\uC5B4',
  ja: '\u65E5\u672C\u8A9E',
};

export type AccountsText = {
  readonly section: string;
  readonly types: Readonly<Record<AccountType, string>>;
  readonly move: (name: string) => string;
  readonly anyMove: RegExp;
  readonly edit: string;
  readonly editTitle: Readonly<Record<'account' | 'group', string>>;
  readonly name: string;
  readonly description: string;
  readonly group: string;
  readonly noGroup: string;
};

export type MultiLineFormText = {
  readonly debitAccounts: string;
  readonly fillDifference: string;
};

export type CatalogueText = {
  readonly accounts: AccountsText;
  readonly directions: Readonly<Record<BalanceDirection, string>>;
  readonly multiLineForm: MultiLineFormText;
  readonly language: string;
  readonly signIn: string;
  readonly google: string;
  readonly settings: string;
  readonly signOut: string;
};

export const CATALOGUE: Readonly<Record<Language, CatalogueText>> = {
  en: {
    accounts: {
      section: 'Accounts',
      types: { Assets: 'Assets', Liabilities: 'Liabilities', Equity: 'Equity', Revenue: 'Revenue', Expenses: 'Expenses' },
      move: (name) => `Move ${name}`,
      anyMove: /^Move /,
      edit: 'Edit',
      editTitle: { account: 'Edit account', group: 'Edit group' },
      name: 'Name',
      description: 'Description',
      group: 'Group',
      noGroup: 'No group',
    },
    directions: { Increase: 'Increase', Decrease: 'Decrease' },
    multiLineForm: { debitAccounts: 'Debit accounts', fillDifference: 'Fill difference' },
    language: 'Language',
    signIn: 'Sign in',
    google: 'Sign in with Google',
    settings: 'Settings',
    signOut: 'Sign out',
  },
  ko: {
    accounts: {
      section: '\uACC4\uC815',
      types: { Assets: '\uC790\uC0B0', Liabilities: '\uBD80\uCC44', Equity: '\uC790\uBCF8', Revenue: '\uC218\uC775', Expenses: '\uBE44\uC6A9' },
      move: (name) => `${name} \uC774\uB3D9`,
      anyMove: / \uC774\uB3D9$/,
      edit: '\uC218\uC815',
      editTitle: { account: '\uACC4\uC815 \uC218\uC815', group: '\uADF8\uB8F9 \uC218\uC815' },
      name: '\uC774\uB984',
      description: '\uC124\uBA85',
      group: '\uADF8\uB8F9',
      noGroup: '\uADF8\uB8F9 \uC5C6\uC74C',
    },
    directions: { Increase: '\uC99D\uAC00', Decrease: '\uAC10\uC18C' },
    multiLineForm: { debitAccounts: '\uCC28\uBCC0 \uACC4\uC815', fillDifference: '\uCC28\uC561 \uCC44\uC6B0\uAE30' },
    language: '\uC5B8\uC5B4',
    signIn: '\uB85C\uADF8\uC778',
    google: 'Google\uB85C \uB85C\uADF8\uC778',
    settings: '\uC124\uC815',
    signOut: '\uB85C\uADF8\uC544\uC6C3',
  },
  ja: {
    accounts: {
      section: '\u52D8\u5B9A\u79D1\u76EE',
      types: { Assets: '\u8CC7\u7523', Liabilities: '\u8CA0\u50B5', Equity: '\u8CC7\u672C', Revenue: '\u53CE\u76CA', Expenses: '\u8CBB\u7528' },
      move: (name) => `${name}\u3092\u79FB\u52D5`,
      anyMove: /\u3092\u79FB\u52D5$/,
      edit: '\u7DE8\u96C6',
      editTitle: { account: '\u52D8\u5B9A\u79D1\u76EE\u3092\u7DE8\u96C6', group: '\u30B0\u30EB\u30FC\u30D7\u3092\u7DE8\u96C6' },
      name: '\u540D\u524D',
      description: '\u8AAC\u660E',
      group: '\u30B0\u30EB\u30FC\u30D7',
      noGroup: '\u30B0\u30EB\u30FC\u30D7\u306A\u3057',
    },
    directions: { Increase: '\u5897\u52A0', Decrease: '\u6E1B\u5C11' },
    multiLineForm: { debitAccounts: '\u501F\u65B9\u306E\u52D8\u5B9A\u79D1\u76EE', fillDifference: '\u5DEE\u984D\u3092\u5165\u529B' },
    language: '\u8A00\u8A9E',
    signIn: '\u30ED\u30B0\u30A4\u30F3',
    google: 'Google\u3067\u30ED\u30B0\u30A4\u30F3',
    settings: '\u8A2D\u5B9A',
    signOut: '\u30ED\u30B0\u30A2\u30A6\u30C8',
  },
};

export const MIDDLE_DOT = '\u00B7';

export const pageTitle = (name: string): string => `${name} ${MIDDLE_DOT} Credebi`;

const IDENTIFIER_FIELD = 'input[name="identifier"]';

export const documentLanguage = (page: Page): Locator => page.locator('html');

export const languageSwitch = (page: Page, shown: Language): Locator =>
  page.getByRole('button', { name: CATALOGUE[shown].language, exact: true });

export const switchMenu = (page: Page): Locator => page.getByRole('menu');

export const switchChoices = (page: Page): Locator => switchMenu(page).getByRole('menuitemradio');

export const switchChoice = (page: Page, language: Language): Locator =>
  switchMenu(page).getByRole('menuitemradio', { name: LANGUAGE_NAMES[language], exact: true });

export const languageChoices = (page: Page, shown: Language): Locator =>
  page.getByRole('group', { name: CATALOGUE[shown].language, exact: true });

export const languageChoice = (page: Page, shown: Language, language: Language): Locator =>
  languageChoices(page, shown).getByRole('radio', { name: LANGUAGE_NAMES[language], exact: true });

export const sidebarSettingsLink = (page: Page, shown: Language): Locator =>
  page.getByRole('navigation').getByRole('link', { name: CATALOGUE[shown].settings, exact: true });

export async function signOutIn(page: Page, shown: Language): Promise<void> {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: CATALOGUE[shown].signOut, exact: true })
    .click();
  await expect(page).not.toHaveURL(ENTRIES_URL);
}

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
    page.getByRole('heading', { level: 1, name: CATALOGUE[language].signIn, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: CATALOGUE[language].google, exact: true })).toBeVisible();
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

export async function submitTestSignInByField(page: Page, identifier: string): Promise<void> {
  const form = page.locator('form').filter({ has: page.locator(IDENTIFIER_FIELD) });
  await form.locator(IDENTIFIER_FIELD).fill(identifier);
  await form.getByRole('button').click();
}

export async function signUpAfterChoosing(page: Page, language: Language): Promise<string> {
  const identifier = freshIdentifier();
  await page.goto('/sign-in');
  if (language !== 'en') await chooseWithSwitch(page, 'en', language);
  await submitTestSignInByField(page, identifier);
  await expect(page).toHaveURL(ENTRIES_URL);
  return identifier;
}

export async function expectSettingsPageIn(page: Page, language: Language): Promise<void> {
  await expect(documentLanguage(page)).toHaveAttribute('lang', language);
  await expect(
    page.getByRole('heading', { level: 1, name: CATALOGUE[language].settings, exact: true }),
  ).toBeVisible();
  await expect(languageChoice(page, language, language)).toBeChecked();
}

async function pressUntilFocused(
  page: Page,
  key: string,
  target: Locator,
  presses: number,
): Promise<void> {
  await expect(target).toBeVisible();
  for (let press = 0; press < presses; press += 1) {
    if ((await target.and(page.locator(':focus')).count()) > 0) break;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

export const tabTo = (page: Page, target: Locator): Promise<void> =>
  pressUntilFocused(page, 'Tab', target, 60);

export const arrowDownTo = (page: Page, target: Locator): Promise<void> =>
  pressUntilFocused(page, 'ArrowDown', target, 4);
