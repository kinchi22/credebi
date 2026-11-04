# ADR-0031: Authorize MCP clients with our own OAuth server

**Status:** Accepted
**Date:** 2026-11-04

## Problem

Feature #645 lets an MCP client, such as ChatGPT or Claude, read a User's books
and post Entries to them over a remote MCP endpoint. The MCP specification
(2026-07-28) requires the endpoint to be an OAuth 2.1 protected resource and
names what its authorization server must do: authorization server metadata
(RFC 8414), protected resource metadata (RFC 9728), authorization code with
PKCE S256, the `resource` parameter (RFC 8707) bound to the token's audience,
and refresh token rotation for public clients. Client ID Metadata Documents
(CIMD) are SHOULD; Dynamic Client Registration (RFC 7591) is MAY and
deprecated. ChatGPT also requires `iss` on every authorization response
(RFC 9207), and Claude Code redirects to a loopback address on an ephemeral
port.

The issue asked for a proven solution over a hand-built server. As of
2026-11-04 none fits:

- `oidc-provider` is Koa-based, takes a Node `(req, res)` where a route handler
  has a Web `Request`, ships only an in-memory store, runs interaction cookies
  of its own beside the Session, and marks CIMD experimental.
- Better Auth's OAuth provider assumes a Better Auth session, which ADR-0021
  rejected for owning the write path, the tables and the failures.
- `@cloudflare/workers-oauth-provider` covers every requirement but imports
  `cloudflare:workers` and hard-codes its storage to Workers KV.
- `@jmondi/oauth2-server` runs on a Web `Request` and handles PKCE, rotation and
  loopback redirects, but always issues JWT access tokens, throws instead of
  returning a `Result`, carries its own entity types into the ports, and has no
  `resource`, `iss` or CIMD.
- `@node-oauth/oauth2-server`, `oauth2orize`, `@openauthjs/openauth` and the
  MCP SDK's legacy auth router lack the same three, or are Express-only,
  dormant or deprecated.
- A hosted server, WorkOS AuthKit's Standalone Connect, keeps Google sign-in
  ours but issues the tokens elsewhere.

This app is both the authorization server and the resource server, in one
deployment over one database, so a token can be an opaque random value looked up
on each request, as a Session is.

## Decision

**The server is ours**, in `packages/core/src/auth/` beside the Session. No OAuth
server library is used. The protocol rules -- PKCE S256 verification, exact
redirect URI matching with a loopback address matched on any port, refresh
rotation, `resource` validation and `iss` -- are pure functions in `domain/`,
tested clause by clause. `@cloudflare/workers-oauth-provider` is the reference
for their edge cases; its rules are ported as tests, its code is not copied.

**Clients identify by CIMD alone.** There is no registration endpoint and no
client table. `/oauth/authorize` fetches the client's metadata document, over
https only, refusing private and loopback addresses, with a size limit and a
timeout, and checks that its `client_id` equals its URL and that the redirect
URI is one it lists. The client's name and redirect URIs are kept with the
Connection the consent creates, and `/oauth/token` checks against that copy
rather than fetching again.

**A Connection is one consent.** Signing in if needed, the User approves the
client's name, shown as unverified, its redirect host and the requested scopes,
all or none. Each approval is a Connection of its own, listed at `/settings`
with its client, redirect host, scopes, creation day and last use, and revoked
there by deleting it.

**Scopes are `read` and `write`.** `read` reaches the tools that read; `write`
reaches `create_entry`. Neither implies the other. A tool outside the token's
scopes is not listed, and calling it answers 403 `insufficient_scope`.

**Tokens are opaque and hashed**, as a Session token is: 32 random bytes, stored
only as their SHA-256 hash.

| Credential | Lifetime |
| ---------- | -------- |
| Authorization code | 60 seconds, used once |
| Access token | 1 hour |
| Refresh token | 30 days, rotated on every use |
| Connection | until revoked, or 30 days without use |

The refresh token a rotation replaced stays usable until its successor is first
used. A refresh token presented after that revokes its whole Connection.

**Paths.** `/mcp`, `/.well-known/oauth-protected-resource/mcp`,
`/.well-known/oauth-authorization-server` and `/oauth/token` answer anybody,
joining the routes ADR-0021 lists; the proxy leaves them alone. `/oauth/authorize`
is a signed-in page. The issuer is the deployment's origin. A request to `/mcp`
without a live Access token answers 401 with `WWW-Authenticate` naming the
protected resource metadata.

**The endpoint** is a route handler at `/mcp` built on
`@modelcontextprotocol/server`, stateless over Streamable HTTP. Its tools are a
controller like a tRPC router: each parses its input with a contract, calls a
use case from the container with the Connection's User as the auth context, and
maps the result. A Domain error is a tool result with `isError` and the
`DomainErrorCode`, so the client can correct itself; it is never a protocol
error. Tool descriptions and results are English and are not Copy.

**Testing.** Where `AUTH_TEST_LOGIN` is set, a CIMD `client_id` may be an http
loopback URL, so a spec serves a client's metadata document and receives its
redirect from inside the test process. `parseEnv` already refuses
`AUTH_TEST_LOGIN` on Production. A real MCP client cannot reach a Preview behind
Deployment Protection, so connecting ChatGPT and Claude is checked by hand on
Production after the milestone merges.

## Consequences

The security-critical part of OAuth is ours to get right: code issuance, PKCE,
redirect matching, rotation and replay, and above all the CIMD fetch, which is
the server reaching a URL a stranger chose. The mutation score and the
integration suite judge it as they judge the Session.

Revoking a Connection takes effect on the next request, because every request
looks its Access token up. That lookup is a database read per tool call.

A client that supports only Dynamic Client Registration cannot connect. Claude
and ChatGPT both support CIMD as of this decision.

The client name on the consent page is whatever the client's document says;
the redirect host is the part a User can trust.

One new dependency, `@modelcontextprotocol/server`, proposed with the change
that introduces it.

## Rejected alternatives

**`oidc-provider`.** Its storage and the consent step would still be written
here, behind a Node-stream bridge, beside a second session, with CIMD
experimental and the stable path the deprecated one.

**Better Auth's OAuth provider.** It replaces ADR-0021's sign-in rather than
extending it; ADR-0021's reasons stand, and MCP is not that ADR's trigger for
looking again.

**`@jmondi/oauth2-server`.** It saves PKCE verification and grant dispatch, and
costs JWT access tokens that a revocable Connection must look up anyway,
exceptions wrapped into `Result`s, and its entity types in the ports, while
`resource`, `iss` and CIMD are still written here.

**`@cloudflare/workers-oauth-provider`.** Running it outside Workers means
replacing its storage at every call site, which is a fork.

**A hosted authorization server.** A second system holding who may reach a
User's books, a JWKS to validate against, and a Preview and E2E setup that has
to reach it.

**Dynamic Client Registration.** Deprecated by the specification, and a table of
clients registered by anybody, one per connection for Claude.

**JWT access tokens.** Validation without a lookup is the benefit, and immediate
revocation gives it up.
