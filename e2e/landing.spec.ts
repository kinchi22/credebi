import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { postEntries, titled } from './entries';
import {
  expectLandingPageIn,
  getStarted,
  headline,
  logIn,
  logo,
  openSampleEntries,
  sampleEntries,
  scrollToEnd,
  scrollToTop,
  scrollWidth,
  shownLineAmounts,
  SOURCE_REPOSITORY,
  sourceLink,
} from './landing';
import { documentLanguage, languageSwitch, signOutIn, switchChoice } from './language';
import { SIGN_IN_URL } from './routes';
import { BOOKS_OPEN, signIn } from './session';
import { sidebar } from './sidebar';
import { PHONE, scrollY } from './viewport';

async function expectLeadsToSignIn(page: Page, open: () => Promise<void>): Promise<void> {
  await page.goto('/');
  await open();
  await expect(page).toHaveURL(SIGN_IN_URL);
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
}

test('shows a signed-out visitor at / Credebi, the value proposition and the three highlights', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');

  await expect(logo(page)).toBeVisible();
  await expectLandingPageIn(page, 'en');
});

test('leads Get started and Log in to the sign-in page', async ({ page }) => {
  await expectLeadsToSignIn(page, () => getStarted(page, 'en').first().click());
  await expectLeadsToSignIn(page, () => logIn(page, 'en').click());
});

test('changes the copy of the Landing page when the visitor chooses Korean in the header Language switch', async ({ page }) => {
  await page.goto('/');
  await expect(headline(page, 'en')).toBeVisible();

  await page.getByRole('banner').getByRole('button', { name: 'Language', exact: true }).click();
  await switchChoice(page, 'ko').click();

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  await expectLandingPageIn(page, 'ko');
  await expect(logIn(page, 'ko')).toBeVisible();
  await expect(getStarted(page, 'ko')).toHaveCount(2);
  await expect(headline(page, 'en')).toHaveCount(0);
  await expect(languageSwitch(page, 'ko')).toBeVisible();
});

test('never shows a signed-out visitor at / the Title of an Entry a User posted', async ({ page }) => {
  const posted = titled(`Private ${randomUUID().slice(0, 8)}`, `Kept private ${randomUUID()}`);
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [posted]);
  await signOutIn(page, 'en');

  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(sidebar(page)).toHaveCount(0);
  await expect(page.getByText(posted.title ?? '')).toHaveCount(0);
  await expect(page.getByText(posted.memo)).toHaveCount(0);
});

test.describe('at 390px', () => {
  test.use({ viewport: PHONE });

  test('lays the Landing page out with no horizontal scroll, from the top to the footer', async ({ page }) => {
    await page.goto('/');
    await expectLandingPageIn(page, 'en');
    expect(await scrollWidth(page)).toBeLessThanOrEqual(PHONE.width);

    await scrollToEnd(page);
    await expect(sourceLink(page, 'en')).toBeInViewport();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(PHONE.width);
  });
});

test('shows no health panel at /', async ({ page }) => {
  await page.goto('/');

  await expect(headline(page, 'en')).toBeVisible();
  await expect(page.getByTestId('health')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Re-check' })).toHaveCount(0);
});

test('opens the multi-line sample Entry of the Entries preview, with its Debit and Credit headings and line amounts, once the visitor scrolls past it, and closes it at the top again', async ({ page }) => {
  await page.goto('/');
  await expect(sampleEntries(page).first()).toBeAttached();
  expect(await openSampleEntries(page), 'no sample Entry is open at the top').toHaveLength(0);

  await scrollToEnd(page);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);

  await expect(async () => {
    const open = await openSampleEntries(page);
    expect(open, 'one sample Entry is open').toHaveLength(1);
    const [entry] = open;
    if (entry === undefined) throw new Error('a sample Entry is open');
    const amounts = await shownLineAmounts(entry);
    expect(amounts.length, 'the open sample Entry shows more than two lines').toBeGreaterThan(2);
    expect(amounts, 'every line of the open sample Entry shows its amount').not.toContain(false);
  }).toPass();

  await scrollToTop(page);
  await expect.poll(() => scrollY(page)).toBe(0);

  await expect.poll(async () => (await openSampleEntries(page)).length, { message: 'the sample Entry closes at the top' }).toBe(0);
});

test('leads both Get started actions to the sign-in page and names the source link in the footer', async ({ page }) => {
  await page.goto('/');
  await expect(getStarted(page, 'en')).toHaveCount(2);
  await expect(sourceLink(page, 'en')).toHaveAttribute('href', SOURCE_REPOSITORY);

  await expectLeadsToSignIn(page, () => getStarted(page, 'en').first().click());
  await expectLeadsToSignIn(page, () => getStarted(page, 'en').last().click());
});
