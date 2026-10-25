# ADR-0029: Run the engine-dependent specs in mobile WebKit too

**Status:** Accepted
**Date:** 2026-10-25

## Problem

Every spec ran in Chromium alone: `playwright.config.ts` had one project, and
every workflow installed `chromium` only. A defect that only WebKit shows passed
every gate. Two reached `main` in one week. #561: iOS Safari zooms in on a typed
control whose text is under 16px. #562: after a tap on a Sidebar link, mobile
WebKit drew a focus ring on `Menu` and Chromium did not. #571 fixed the second
by passing `focus({ focusVisible: false })` on a pointer click, and nothing turns
red if that line is removed.

Running the whole suite in a second engine would catch such a regression, at the
cost of a second full suite on every run that reaches the specs, almost all of
whose specs state behaviour no engine changes.

## Decision

**Chromium runs every spec. Mobile WebKit runs only the specs tagged
`@webkit`.** `playwright.config.ts` has two projects:

- `chromium`, Desktop Chrome, with no filter.
- `mobile-webkit`, WebKit emulating an iPhone at `PHONE` from `e2e/viewport.ts`
  (390 x 844), with touch and mobile emulation on, and `grep: /@webkit/`.

A spec tagged `{ tag: '@webkit' }` therefore runs in both projects, and an
untagged spec in Chromium alone. `pnpm test:e2e` runs both projects locally.

**A spec is tagged `@webkit` only when the behaviour it states depends on the
engine**, such as which element matches `:focus-visible` after a tap. A layout
or a flow that every engine renders the same way stays untagged.

**A spec is never tagged both `@smoke` and `@webkit`.** The Smoke runs filter by
`--grep @smoke` and install Chromium alone, so a spec carrying both tags would
send the Smoke run into WebKit with no browser to launch.
`tools/gates/e2e-projects-gate.test.ts` fails if any Smoke-tagged spec is listed
outside `chromium`.

**Every CI run of the specs a tagged spec reaches installs WebKit beside
Chromium:** `Gate liveness` in `ci.yml`, and `E2E build` with both advisory
legs in `e2e-build.yml`. The Smoke runs -- `candidate-production-smoke.yml`,
`promoted-production-smoke.yml` and the compatibility run in
`production-release.yml` -- keep installing Chromium alone. The same gate test
asserts each workflow's install line.

The liveness rule of ADR-0006 and the advisory groups need no change: each reads
a spec's tests whatever their project, so a tagged spec must fail against the
empty page in both engines, and a group counts each project's run of it.

## Consequences

Each run of `Gate liveness` and of `E2E build` now installs WebKit, uncached,
whether or not any spec is tagged. With no spec tagged, the `mobile-webkit`
project selects nothing and no WebKit browser is launched; the install is paid
for nothing until the first tagged spec lands.

Playwright's WebKit is not Safari on an iPhone. It emulates a phone's viewport,
touch and user agent on the WebKit engine, so it guards behaviour the engine
decides, like `:focus-visible`, and not what iOS itself does around the page. A
defect like #561, where iOS zooms on focus, is still caught by a computed-style
assertion in Chromium rather than by WebKit.

Whether a behaviour depends on the engine is a judgement made when a spec is
written, and no gate checks it. An untagged spec that should have been tagged
leaves a WebKit-only regression to pass, as before this decision.

## Rejected alternatives

**Run the whole suite in WebKit.** It doubles the run of every spec on every pull
request into `main` and every milestone push, to guard the handful whose
behaviour an engine changes.

**Add Firefox as well.** No defect so far has been specific to it, and each
engine costs an install on every run.

**Desktop WebKit instead of mobile.** Both known defects were on a phone, after
a tap; a desktop viewport has no drawer to open and no touch to tap with.

**A separate workflow, or job, for the WebKit specs.** It would install the app
and build it a second time, and it would be a new required check to add to both
rulesets by hand. A second project in the same run reuses both.

**Install WebKit in the Smoke runs too.** A release would wait on a browser
install for specs that may not read Production, and the rule that no spec is
tagged both ways keeps the Smoke run in Chromium for nothing.
