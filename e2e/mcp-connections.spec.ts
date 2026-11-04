import { documentLanguage, signOutIn, signUpAfterChoosing } from './language';
import {
  connectionItems,
  connectionsSection,
  expectUnauthorized,
  listTools,
  mcpPost,
  revokeButton,
  revokeConnection,
  shownOnToday,
} from './mcp';
import {
  connect,
  denyButton,
  expect,
  expectInvalidGrant,
  LOOPBACK_HOST,
  newAuthorization,
  openConsent,
  originOf,
  redirectedTo,
  refreshWith,
  startClient,
  test,
} from './oauth';
import { SETTINGS_PATH } from './routes';
import { freshIdentifier, signIn } from './session';

test('lists each Connection at `/settings` with its MCP client, redirect host, scopes, creation day and last use', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client, { scopes: ['read'] });
  await listTools(request, tokens.accessToken);

  await page.goto(SETTINGS_PATH);

  const item = connectionsSection(page).getByRole('listitem').filter({ hasText: client.name });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(LOOPBACK_HOST);
  await expect(item).toContainText(/\bread\b/i);
  await expect(item).not.toContainText(/\bwrite\b/i);
  await expect(item).toContainText(shownOnToday('Created'));
  await expect(item).toContainText(shownOnToday('Last used'));
});

test('lists a Connection for each approval, and none for a denial', async ({ page, request, baseURL, client }) => {
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
  await expect(items.filter({ hasText: /\bread\b/i })).toHaveCount(1);
  await expect(items.filter({ hasText: /\bwrite\b/i })).toHaveCount(2);
});

test('revokes a Connection at `/settings`, refusing its Access token and its refresh token on their next use', async ({ page, request, baseURL, client }) => {
  const keptClient = await startClient();
  await signIn(page);
  const revoked = await connect(page, request, client);
  const kept = await connect(page, request, keptClient);
  expect(await listTools(request, revoked.tokens.accessToken)).not.toEqual([]);
  await page.goto(SETTINGS_PATH);
  await expect(connectionItems(page, client.name)).toHaveCount(1);

  await revokeConnection(connectionItems(page, client.name));

  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await page.reload();
  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await expect(connectionItems(page, keptClient.name)).toHaveCount(1);
  await expectUnauthorized(await mcpPost(request, revoked.tokens.accessToken, 'tools/list'), originOf(baseURL));
  await expectInvalidGrant(
    await refreshWith(request, revoked.authorization.clientId, revoked.tokens.refreshToken),
  );
  expect(await listTools(request, kept.tokens.accessToken)).not.toEqual([]);
  await keptClient.close();
});

test('asks for confirmation before revoking, and keeps the Connection when the User backs out', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client);
  await page.goto(SETTINGS_PATH);
  const item = connectionItems(page, client.name);

  await revokeButton(item).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

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
  await expect(revokeButton(item)).toHaveCount(0);
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

test('never lists one User\'s Connections to another User', async ({ page, browser, request, client }) => {
  const otherClient = await startClient();
  await signIn(page);
  await connect(page, request, client);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await connect(otherPage, request, otherClient);

  await page.goto(SETTINGS_PATH);
  await otherPage.goto(SETTINGS_PATH);

  await expect(connectionItems(page, client.name)).toHaveCount(1);
  await expect(connectionItems(page, otherClient.name)).toHaveCount(0);
  await expect(connectionItems(otherPage, otherClient.name)).toHaveCount(1);
  await expect(connectionItems(otherPage, client.name)).toHaveCount(0);
  await other.close();
  await otherClient.close();
});
