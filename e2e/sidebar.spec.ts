import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryForm, entrySearchForm } from './entries';
import { ENTRIES_URL, ENTRY_SEARCH_WITHOUT_QUERY, SETTINGS_URL, SIGN_IN_URL } from './routes';
import { signIn } from './session';
import { entryFormModes } from './settings';
import { SIGNED_IN_PAGES, menu, sidebar } from './sidebar';
import { PHONE } from './viewport';

const sidebarLink = (page: Page, name: 'Entries' | 'Entry search' | 'Settings'): Locator =>
  sidebar(page).getByRole('link', { name, exact: true });

const sidebarSignOut = (page: Page): Locator =>
  sidebar(page).getByRole('button', { name: 'Sign out' });

test('shows the Sidebar on every signed-in page, with links to Entries, Entry search and Settings and the only Sign out', async ({ page }) => {
  await signIn(page);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(sidebarLink(page, 'Entries')).toBeVisible();
    await expect(sidebarLink(page, 'Entry search')).toBeVisible();
    await expect(sidebarLink(page, 'Settings')).toBeVisible();
    await expect(sidebarSignOut(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(1);
  }
});

test('moves between the signed-in pages through the Sidebar', async ({ page }) => {
  await signIn(page);

  await sidebarLink(page, 'Entry search').click();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
  await expect(entrySearchForm(page)).toBeVisible();

  await sidebarLink(page, 'Settings').click();
  await expect(page).toHaveURL(SETTINGS_URL);
  await expect(entryFormModes(page)).toBeVisible();

  await sidebarLink(page, 'Entries').click();
  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(entryForm(page)).toBeVisible();
});

test('ends the Session when the User signs out from the Sidebar', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');

  await sidebarSignOut(page).click();
  await expect(page).not.toHaveURL(SETTINGS_URL);

  await page.goto('/settings');
  await expect(page).toHaveURL(SIGN_IN_URL);
});

test('shows no Sidebar once the visitor is no longer signed in', async ({ page }) => {
  await signIn(page);
  await expect(sidebar(page)).toBeVisible();
  await sidebarSignOut(page).click();
  await expect(page).not.toHaveURL(ENTRIES_URL);

  await page.goto('/');
  await expect(page.getByTestId('health')).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);

  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);
});

test('puts the Sidebar behind a Menu button at 390px, whose drawer holds the links and Sign out', async ({ page }) => {
  await signIn(page);
  await expect(sidebar(page)).toBeVisible();
  await expect(menu(page)).toBeHidden();

  await page.setViewportSize(PHONE);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(menu(page)).toBeVisible();
    await expect(sidebar(page)).toBeHidden();

    await menu(page).click();
    await expect(sidebarLink(page, 'Entries')).toBeVisible();
    await expect(sidebarLink(page, 'Entry search')).toBeVisible();
    await expect(sidebarLink(page, 'Settings')).toBeVisible();
    await expect(sidebarSignOut(page)).toBeVisible();
  }

  await sidebarLink(page, 'Entry search').click();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
  await expect(entrySearchForm(page)).toBeVisible();
});

test('focuses the drawer, not a Sidebar link, when Menu opens it, and Tab then focuses Entries', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await menu(page).click();
  await expect(sidebar(page)).toBeFocused();
  await expect(sidebarLink(page, 'Entries')).not.toBeFocused();
  await expect(sidebarLink(page, 'Entry search')).not.toBeFocused();
  await expect(sidebarLink(page, 'Settings')).not.toBeFocused();

  await page.keyboard.press('Tab');
  const entries = sidebarLink(page, 'Entries');
  await expect(entries).toBeFocused();
  await expect(entries.and(page.locator(':focus-visible'))).toBeVisible();
});

const FOCUS_VISIBLE_ON_FOCUS = 'data-focus-visible-on-focus';

type FocusableElement = {
  readonly addEventListener: (type: 'focus', listener: () => void) => void;
  readonly setAttribute: (name: string, value: string) => void;
  readonly matches: (selector: string) => boolean;
};

async function recordFocusVisibleOnFocus(target: Locator): Promise<void> {
  await target.evaluate((element: FocusableElement, attribute) => {
    element.addEventListener('focus', () => {
      element.setAttribute(attribute, String(element.matches(':focus-visible')));
    });
  }, FOCUS_VISIBLE_ON_FOCUS);
}

async function openDrawerWithKeyboard(page: Page): Promise<void> {
  await menu(page).focus();
  await page.keyboard.press('Enter');
  await expect(sidebar(page)).toBeFocused();
}

test.describe('on a touch phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('returns focus to Menu without a ring when the User taps the current page in the drawer', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);

    await menu(page).tap();
    await expect(sidebarLink(page, 'Entries')).toBeVisible();
    await recordFocusVisibleOnFocus(menu(page));

    await sidebarLink(page, 'Entries').tap();
    await expect(sidebar(page)).toBeHidden();
    await expect(menu(page)).toHaveAttribute(FOCUS_VISIBLE_ON_FOCUS, 'false');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('returns focus to Menu with a ring when the User follows a drawer link with Enter', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);

    await openDrawerWithKeyboard(page);
    await recordFocusVisibleOnFocus(menu(page));
    await sidebarLink(page, 'Entries').focus();
    await expect(sidebarLink(page, 'Entries')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(sidebar(page)).toBeHidden();
    await expect(menu(page)).toHaveAttribute(FOCUS_VISIBLE_ON_FOCUS, 'true');
  });

  test('returns focus to Menu with a ring when the User dismisses the drawer with Escape', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);

    await openDrawerWithKeyboard(page);
    await recordFocusVisibleOnFocus(menu(page));

    await page.keyboard.press('Escape');
    await expect(sidebar(page)).toBeHidden();
    await expect(menu(page)).toHaveAttribute(FOCUS_VISIBLE_ON_FOCUS, 'true');
  });
});
