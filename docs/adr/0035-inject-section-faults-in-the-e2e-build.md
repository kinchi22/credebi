# ADR-0035: Inject section faults in the E2E build

**Status:** Accepted
**Date:** 2026-11-28

## Problem

Progressive rendering shows a Skeleton while a section's data is pending and an
error with `Try again` when it fails. Both states last milliseconds against a
real database, so a spec cannot observe them, and a requirement nothing can
observe is unverified. A spec needs to make one named section slow or failing,
for its own requests alone, because the specs run in parallel against one server.

## Decision

The E2E build can hold or fail named sections. It is the production build, with
a code path that exists only to be exercised by the specs.

- `E2E_SECTION_FAULTS`, any non-empty value, turns it on. `parseEnv` refuses it
  when `VERCEL_ENV=production`, the same way and for the same reason as
  `AUTH_TEST_LOGIN` (ADR-0005, ADR-0021). The `test:e2e` step of `E2E build` and
  a local `.env` set it; Vercel never does.
- A request carrying the cookie `credebi-faults` has the sections it names held
  or failed. The value is `<token>;<section>:<mode>,...` percent-encoded, the
  token a fresh UUID per spec and the mode `hold` or `fail`. The sections are a
  closed list kept as literals in `apps/web/server/section-faults.ts` and, apart,
  in `e2e/section-faults.ts`; a drift fails the specs.
- A held read waits on an in-process latch per token and section. `POST
  /api/e2e/faults/<token>/<section>/release` opens it, and an open latch stays
  open. A failed read throws. The spec lifts a failure by removing the section
  from the cookie and pressing `Try again`.
- The composition root applies it, through `Container.sectionFaults`, and
  `withSectionFault` wraps a section's read. `packages/core` knows nothing of it.
- Without the variable the container holds a no-op, the cookie changes nothing
  and the release route answers 404.

## Consequences

Production ships the code that reads the cookie and serves the release route.
What keeps it inert there is the refusal in `parseEnv`: a deployment with the
variable set on Production answers its first request with a 500. Nothing
verifies on Production that the variable is absent beyond that refusal.

The latch lives in one process. That holds for the E2E build, which is a single
`next start`, and would not for a deployment with several instances; nothing
else turns it on.

The section list is stated twice, so adding a section means editing both files.

## Rejected alternatives

**Component tests.** No component tests exist, and an async Server Component does
not stream under jsdom, so a component test could not show the Skeleton giving
way to content.

**No injection.** Leaves every loading and error state unverified, which is the
whole of what the Feature promises.

**A fault per read rather than per section.** Holding `entries.list` must not
hold the entry form, though both read the chart of accounts, so the unit that
faults is the section the User sees.

**A separate build or a Playwright route intercept.** The page's reads happen on
the server, where the browser's network interception cannot reach them, and a
second build would no longer be the one that ships.
