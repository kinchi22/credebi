import { expect, type Locator, type Page } from '@playwright/test';
import { SIDES } from './entries';
import { type Language } from './language';

export type LandingText = {
  readonly headline: string;
  readonly valueProposition: string;
  readonly highlights: readonly [string, string, string];
  readonly getStarted: string;
  readonly logIn: string;
  readonly source: string;
};

export const LANDING: Readonly<Record<Exclude<Language, 'ja'>, LandingText>> = {
  en: {
    headline: 'See where your money came from, and where it went.',
    valueProposition:
      'Record every transaction on two sides and your balances always add up, with assets, liabilities, income and spending in one set of books.',
    highlights: ['Every transaction, both sides', 'Watch your net worth grow', 'What came in, what went out'],
    getStarted: 'Get started',
    logIn: 'Log in',
    source: 'View the source on GitHub',
  },
  ko: {
    headline: '\uB0B4 \uB3C8\uC774 \uC5B4\uB514\uC11C \uC640\uC11C \uC5B4\uB514\uB85C \uAC14\uB294\uC9C0, \uD55C\uB208\uC5D0.',
    valueProposition:
      '\uBAA8\uB4E0 \uAC70\uB798\uB97C \uB450 \uCABD\uC73C\uB85C \uAE30\uB85D\uD558\uBA74 \uC794\uC561\uC774 \uC800\uC808\uB85C \uB9DE\uACE0, \uC790\uC0B0\u00B7\uBD80\uCC44\u00B7\uC218\uC785\u00B7\uC9C0\uCD9C\uC774 \uD55C \uC7A5\uBD80\uC5D0\uC11C \uC774\uC5B4\uC9D1\uB2C8\uB2E4.',
    highlights: [
      '\uBAA8\uB4E0 \uAC70\uB798\uB97C \uB450 \uCABD\uC73C\uB85C',
      '\uC21C\uC790\uC0B0\uC774 \uC790\uB77C\uB294 \uBAA8\uC2B5',
      '\uC774\uBC88 \uB2EC \uC5BC\uB9C8 \uBC8C\uACE0 \uC5BC\uB9C8 \uC37C\uB098',
    ],
    getStarted: '\uC2DC\uC791\uD558\uAE30',
    logIn: '\uB85C\uADF8\uC778',
    source: 'GitHub\uC5D0\uC11C \uC18C\uC2A4 \uBCF4\uAE30',
  },
};

export const SOURCE_REPOSITORY = /^https:\/\/github\.com\/[\w.-]+\/credebi\/?$/;

export const headline = (page: Page, language: Exclude<Language, 'ja'>): Locator =>
  page.getByRole('heading', { level: 1, name: LANDING[language].headline, exact: true });

export const valueProposition = (page: Page, language: Exclude<Language, 'ja'>): Locator =>
  page.getByText(LANDING[language].valueProposition, { exact: true });

export const highlight = (page: Page, name: string): Locator =>
  page.getByRole('heading', { name, exact: true });

export const logIn = (page: Page, language: Exclude<Language, 'ja'>): Locator =>
  page.getByRole('banner').getByRole('link', { name: LANDING[language].logIn, exact: true });

export const getStarted = (page: Page, language: Exclude<Language, 'ja'>): Locator =>
  page.getByRole('link', { name: LANDING[language].getStarted, exact: true });

export const sourceLink = (page: Page, language: Exclude<Language, 'ja'>): Locator =>
  page.getByRole('contentinfo').getByRole('link', { name: LANDING[language].source, exact: true });

export const logo = (page: Page): Locator =>
  page.getByRole('banner').getByRole('img', { name: 'Credebi', exact: true });

export async function expectLandingPageIn(page: Page, language: Exclude<Language, 'ja'>): Promise<void> {
  await expect(headline(page, language)).toBeVisible();
  await expect(valueProposition(page, language)).toBeVisible();
  for (const name of LANDING[language].highlights) {
    await expect(highlight(page, name)).toBeVisible();
  }
}

export const sampleEntries = (page: Page): Locator => page.getByTestId('entry');

const LINE_AMOUNT = /^\d{1,3}(?:,\d{3})*$/;

async function isShown(locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  return box !== null && box.width > 1 && box.height > 1;
}

async function anyShown(locator: Locator): Promise<boolean> {
  const shown = await Promise.all((await locator.all()).map(isShown));
  return shown.includes(true);
}

async function showsBothSides(entry: Locator): Promise<boolean> {
  const sides = await Promise.all(SIDES.map((side) => anyShown(entry.getByText(side, { exact: true }))));
  return sides.every(Boolean);
}

export async function openSampleEntries(page: Page): Promise<readonly Locator[]> {
  const listed = await sampleEntries(page).all();
  const open = await Promise.all(listed.map(showsBothSides));
  return listed.filter((_, index) => open[index] === true);
}

export async function shownLineAmounts(entry: Locator): Promise<readonly boolean[]> {
  const lines = await entry.getByTestId('entry-line').all();
  const shownLines = (await Promise.all(lines.map(async (line) => ((await isShown(line)) ? line : undefined)))).filter(
    (line): line is Locator => line !== undefined,
  );
  return Promise.all(shownLines.map((line) => anyShown(line.getByText(LINE_AMOUNT))));
}

export async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
}

export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate('window.scrollTo(0, 0)');
}

export const scrollWidth = async (page: Page): Promise<number> =>
  Number(await page.evaluate('document.documentElement.scrollWidth'));
