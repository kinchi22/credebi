import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { ENTRIES_URL } from './routes';

export const SESSION_COOKIE = 'session';

export const freshIdentifier = (): string => `e2e-${randomUUID()}`;

export type SignInOptions = {
  readonly identifier?: string;
  readonly accountsStartOn?: string;
};

export async function submitTestSignIn(
  page: Page,
  identifier: string,
  accountsStartOn?: string,
): Promise<void> {
  const form = page.getByRole('form', { name: 'Test sign-in' });
  await form.getByLabel('Identifier').fill(identifier);
  if (accountsStartOn !== undefined) {
    await form.getByLabel('Accounts start on').fill(accountsStartOn);
  }
  await form.getByRole('button', { name: 'Sign in' }).click();
}

export async function signIn(
  page: Page,
  { identifier = freshIdentifier(), accountsStartOn }: SignInOptions = {},
): Promise<void> {
  await page.goto('/sign-in');
  await submitTestSignIn(page, identifier, accountsStartOn);
  await expect(page).toHaveURL(ENTRIES_URL);
}

const issuedSession = (setCookie: string | null): string | undefined =>
  new RegExp(`(?:^|\\n)${SESSION_COOKIE}=([^;]*)`).exec(setCookie ?? '')?.[1];

export async function signInKeepingSessionOverHttp(
  page: Page,
  options: SignInOptions = {},
): Promise<void> {
  if (page.context().browser()?.browserType().name() !== 'webkit') {
    await signIn(page, options);
    return;
  }
  const issuing = page.waitForResponse(async (response) =>
    issuedSession(await response.headerValue('set-cookie')) !== undefined,
  );
  await signIn(page, options);
  const session = issuedSession(await (await issuing).headerValue('set-cookie'));
  expect(session, 'signing in issues a session cookie').toBeDefined();
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: session ?? '', url: page.url(), httpOnly: true, sameSite: 'Lax', secure: false },
  ]);
}

export async function signInForSmoke(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
): Promise<void> {
  const token = process.env['SMOKE_SESSION_TOKEN'] ?? '';
  if (token === '') {
    await signIn(page);
    return;
  }
  expect(baseURL, 'the smoke run needs a baseURL to scope the cookie to').toBeDefined();
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL ?? '' }]);
}
