import { type APIRequestContext } from '@playwright/test';
import { dayInBrowser } from './accounts';
import { documentLanguage, signOutIn, signUpAfterChoosing } from './language';
import { expectUnauthorized, listTools, mcpPost } from './mcp';
import {
  connect,
  denyButton,
  expect,
  expectInvalidGrant,
  LOOPBACK_HOST,
  newAuthorization,
  openConsent,
  originOf,
  RAW_SCOPE_NAME,
  redirectedTo,
  refreshWith,
  SCOPE_SHOWN,
  test,
  type Connected,
} from './oauth';
import { SETTINGS_PATH } from './routes';
import { freshIdentifier, signIn } from './session';
import {
  connectionItems,
  connectionsSection,
  revokeButton,
  revokeConnection,
  revokeDialog,
  shownOn,
} from './settings';

test('lists each Connection at `/settings` with its MCP client, redirect host, scopes, creation day and last use', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client, { scopes: ['read'] });
  await listTools(request, tokens.accessToken);

  await page.goto(SETTINGS_PATH);

  const today = await dayInBrowser(page);
  const item = connectionsSection(page).getByRole('listitem').filter({ hasText: client.name });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(LOOPBACK_HOST);
  await expect(item).toContainText(SCOPE_SHOWN.read);
  await expect(item).not.toContainText(SCOPE_SHOWN.write);
  await expect(item).not.toContainText(RAW_SCOPE_NAME);
  await expect(item).toContainText(shownOn('Created', today));
  await expect(item).toContainText(shownOn('Last used', today));
});

test('lists a Connection for each approval, each with the scopes it was granted in words, and none for a denial', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  await connect(page, request, client);
  await connect(page, request, client, { scopes: ['write'] });
  const authorization = newAuthorization(client, baseURL);
  await openConsent(page, authorization);
  await denyButton(page).click();
  await redirectedTo(page, client.redirectUri);

  await page.goto(SETTINGS_PATH);

  const items = connectionsSection(page).getByRole('listitem').filter({ hasText: client.name });
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: SCOPE_SHOWN.read })).toHaveCount(1);
  await expect(items.filter({ hasText: SCOPE_SHOWN.write })).toHaveCount(2);
  await expect(items.filter({ hasText: RAW_SCOPE_NAME })).toHaveCount(0);
});

async function expectRevoked(
  request: APIRequestContext,
  revoked: Connected,
  origin: string,
): Promise<void> {
  await expectUnauthorized(await mcpPost(request, revoked.tokens.accessToken, 'tools/list'), origin);
  await expectInvalidGrant(
    await refreshWith(request, revoked.authorization.clientId, revoked.tokens.refreshToken),
  );
}

test('revokes a Connection at `/settings`, refusing its Access token and its refresh token on their next use', async ({ page, request, baseURL, client, otherClient }) => {
  await signIn(page);
  const revoked = await connect(page, request, client);
  const kept = await connect(page, request, otherClient);
  expect(await listTools(request, revoked.tokens.accessToken)).not.toEqual([]);
  await page.goto(SETTINGS_PATH);
  await expect(connectionItems(page, client.name)).toHaveCount(1);

  await revokeConnection(connectionItems(page, client.name), client.name);

  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await page.reload();
  await expect(connectionItems(page, otherClient.name)).toHaveCount(1);
  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await expectRevoked(request, revoked, originOf(baseURL));
  expect(await listTools(request, kept.tokens.accessToken)).not.toEqual([]);
});

test('revokes one of two Connections of the same MCP client, leaving the other working', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const kept = await connect(page, request, client, { scopes: ['read'] });
  const revoked = await connect(page, request, client, { scopes: ['read', 'write'] });
  await page.goto(SETTINGS_PATH);
  const items = connectionItems(page, client.name);
  await expect(items).toHaveCount(2);

  await revokeConnection(items.filter({ hasText: SCOPE_SHOWN.write }), client.name);

  await page.reload();
  await expect(connectionItems(page, client.name)).toHaveCount(1);
  await expect(connectionItems(page, client.name)).not.toContainText(SCOPE_SHOWN.write);
  await expectRevoked(request, revoked, originOf(baseURL));
  expect(await listTools(request, kept.tokens.accessToken)).not.toEqual([]);
});

test('asks for confirmation in Revoke connection, naming the MCP client and its redirect host, and keeps the Connection when the User backs out', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client);
  await page.goto(SETTINGS_PATH);
  const item = connectionItems(page, client.name);

  await revokeButton(item, client.name).click();
  const dialog = revokeDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(client.name);
  await expect(dialog).toContainText(LOOPBACK_HOST);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(connectionItems(page, client.name)).toHaveCount(1);
  expect(await listTools(request, tokens.accessToken)).not.toEqual([]);
});

test('lists the Connections in the User\'s Language', async ({ page, request, client }) => {
  await signUpAfterChoosing(page, 'ko');
  await connect(page, request, client);

  await page.goto(SETTINGS_PATH);

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  const item = connectionItems(page, client.name);
  await expect(item).toHaveCount(1);
  await expect(item.getByRole('button')).toHaveCount(1);
  await expect(item.getByRole('button')).toHaveAccessibleName(new RegExp(client.name));
  await expect(revokeButton(item, client.name)).toHaveCount(0);
  await expect(item).not.toContainText(SCOPE_SHOWN.read);
  await expect(item).not.toContainText(RAW_SCOPE_NAME);
  await expect(connectionsSection(page)).toHaveCount(0);
});

test('leaves the Connections alone when the User signs out of the web app', async ({ page, request, client }) => {
  const identifier = freshIdentifier();
  await signIn(page, { identifier });
  const { tokens } = await connect(page, request, client);
  await page.goto('/entries');

  await signOutIn(page, 'en');

  expect(await listTools(request, tokens.accessToken)).not.toEqual([]);
  await signIn(page, { identifier });
  await page.goto(SETTINGS_PATH);
  await expect(connectionItems(page, client.name)).toHaveCount(1);
});

test('never lists one User\'s Connections to another User', async ({ page, browser, request, client, otherClient }) => {
  await signIn(page);
  await connect(page, request, client);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage);
    await connect(otherPage, request, otherClient);

    await page.goto(SETTINGS_PATH);
    await otherPage.goto(SETTINGS_PATH);

    await expect(connectionItems(page, client.name)).toHaveCount(1);
    await expect(connectionItems(page, otherClient.name)).toHaveCount(0);
    await expect(connectionItems(otherPage, otherClient.name)).toHaveCount(1);
    await expect(connectionItems(otherPage, client.name)).toHaveCount(0);
  } finally {
    await other.close();
  }
});
