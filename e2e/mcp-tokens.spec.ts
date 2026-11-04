import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { expectUnauthorized, listTools, mcpPost } from './mcp';
import {
  ACCESS_TOKEN_SECONDS,
  authorizationCode,
  CODE_SECONDS,
  connect,
  exchangeCode,
  expect,
  expectInvalidGrant,
  newAuthorization,
  newPkce,
  originOf,
  refreshWith,
  test,
  tokensFrom,
} from './oauth';
import { signIn } from './session';

test('exchanges an authorization code and its PKCE verifier for an hour-long Bearer Access token and a refresh token', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);
  const code = await authorizationCode(page, authorization);

  const tokens = await tokensFrom(await exchangeCode(request, authorization, code));

  expect(tokens.tokenType.toLowerCase()).toBe('bearer');
  expect(tokens.expiresIn).toBe(ACCESS_TOKEN_SECONDS);
  expect(tokens.refreshToken).not.toBe('');
  expect(tokens.refreshToken).not.toBe(tokens.accessToken);
  expect(tokens.scopes).toEqual(['read', 'write']);
  expect(await listTools(request, tokens.accessToken)).not.toEqual([]);
});

test('refuses an authorization code the second time it is exchanged', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);
  const code = await authorizationCode(page, authorization);
  await tokensFrom(await exchangeCode(request, authorization, code));

  await expectInvalidGrant(await exchangeCode(request, authorization, code));
});

test('refuses an authorization code once its 60 seconds have passed', async ({ page, request, baseURL, client }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);
  const code = await authorizationCode(page, authorization);

  await sleep((CODE_SECONDS + 2) * 1000);

  await expectInvalidGrant(await exchangeCode(request, authorization, code));
});

test.describe('refuses an authorization code exchanged', () => {
  test('with another PKCE verifier', async ({ page, request, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);
    const code = await authorizationCode(page, authorization);

    await expectInvalidGrant(
      await exchangeCode(request, authorization, code, { code_verifier: newPkce().verifier }),
    );
  });

  test('with no PKCE verifier', async ({ page, request, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);
    const code = await authorizationCode(page, authorization);

    const response = await exchangeCode(request, authorization, code, { code_verifier: null });

    expect(response.status()).toBe(400);
    expect(await response.json()).not.toHaveProperty('access_token');
  });

  test('for another redirect', async ({ page, request, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);
    const code = await authorizationCode(page, authorization);

    await expectInvalidGrant(
      await exchangeCode(request, authorization, code, { redirect_uri: `${client.origin}/elsewhere` }),
    );
  });

  test('by another client', async ({ page, request, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);
    const code = await authorizationCode(page, authorization);

    await expectInvalidGrant(
      await exchangeCode(request, authorization, code, { client_id: `${client.origin}/other.json` }),
    );
  });

  test('that it never issued', async ({ page, request, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);
    await authorizationCode(page, authorization);

    await expectInvalidGrant(await exchangeCode(request, authorization, randomUUID()));
  });
});

test('refreshes an Access token with a new refresh token every time', async ({ page, request, client }) => {
  await signIn(page);
  const { authorization, tokens } = await connect(page, request, client);

  const refreshed = await tokensFrom(await refreshWith(request, authorization.clientId, tokens.refreshToken));

  expect(refreshed.accessToken).not.toBe(tokens.accessToken);
  expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);
  expect(refreshed.expiresIn).toBe(ACCESS_TOKEN_SECONDS);
  expect(refreshed.scopes).toEqual(tokens.scopes);
  expect(await listTools(request, refreshed.accessToken)).toEqual(
    await listTools(request, tokens.accessToken),
  );

  const again = await tokensFrom(await refreshWith(request, authorization.clientId, refreshed.refreshToken));
  expect(again.refreshToken).not.toBe(refreshed.refreshToken);
  expect(await listTools(request, again.accessToken)).not.toEqual([]);
});

test('keeps the replaced refresh token working until its successor is first used', async ({ page, request, client }) => {
  await signIn(page);
  const { authorization, tokens } = await connect(page, request, client);
  await tokensFrom(await refreshWith(request, authorization.clientId, tokens.refreshToken));

  const retried = await tokensFrom(await refreshWith(request, authorization.clientId, tokens.refreshToken));

  expect(await listTools(request, retried.accessToken)).not.toEqual([]);
  const next = await tokensFrom(await refreshWith(request, authorization.clientId, retried.refreshToken));
  expect(await listTools(request, next.accessToken)).not.toEqual([]);
});

test('revokes the whole Connection when a replaced refresh token comes back after its successor was used', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const { authorization, tokens } = await connect(page, request, client);
  const successor = await tokensFrom(await refreshWith(request, authorization.clientId, tokens.refreshToken));
  const latest = await tokensFrom(await refreshWith(request, authorization.clientId, successor.refreshToken));

  await expectInvalidGrant(await refreshWith(request, authorization.clientId, tokens.refreshToken));

  const origin = originOf(baseURL);
  await expectUnauthorized(await mcpPost(request, latest.accessToken, 'tools/list'), origin);
  await expectInvalidGrant(await refreshWith(request, authorization.clientId, latest.refreshToken));
});

test.describe('refuses with invalid_grant a refresh', () => {
  test('with a token it never issued', async ({ page, request, client }) => {
    await signIn(page);
    const { authorization } = await connect(page, request, client);

    await expectInvalidGrant(await refreshWith(request, authorization.clientId, randomUUID()));
  });

  test('by another client', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client);

    await expectInvalidGrant(await refreshWith(request, `${client.origin}/other.json`, tokens.refreshToken));
  });

  test('with an Access token', async ({ page, request, client }) => {
    await signIn(page);
    const { authorization, tokens } = await connect(page, request, client);

    await expectInvalidGrant(await refreshWith(request, authorization.clientId, tokens.accessToken));
  });
});
