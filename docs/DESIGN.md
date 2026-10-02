---
version: alpha
name: Credebi
description: The brand palette, semantic tokens, type scale and logo rules of Credebi, light theme only.
omitted:
  - section: spacing
    reason: Spacing stays on Tailwind's default scale; no spacing token is decided.
  - section: rounded
    reason: Corner radii stay on Tailwind's default scale; no radius token is decided.
colors:
  mint: "#2FD0A2"
  mint-deep: "#0B7A5E"
  mint-deeper: "#09644D"
  ink: "#0B2B2A"
  ink-raised: "#133F3C"
  mist: "#F2F8F5"
  frost: "#EAF7F2"
  white: "#FFFFFF"
  slate: "#4A6461"
  sage: "#9FC4BC"
  fog: "#E1ECE8"
  steel: "#78948F"
  rust: "#B4400F"
  ochre: "#A15C00"
  cobalt: "#2B63B8"
  gold: "#7F6500"
  pewter: "#747775"
  azure: "#4285F4"
  leaf: "#34A853"
  amber: "#FBBC05"
  scarlet: "#EA4335"
  surface: "{colors.white}"
  ground: "{colors.mist}"
  text: "{colors.ink}"
  text-muted: "{colors.slate}"
  text-on-dark: "{colors.frost}"
  text-muted-on-dark: "{colors.sage}"
  ground-dark: "{colors.ink}"
  ground-dark-raised: "{colors.ink-raised}"
  accent: "{colors.mint}"
  accent-text: "{colors.mint-deep}"
  accent-text-hover: "{colors.mint-deeper}"
  border: "{colors.fog}"
  border-control: "{colors.steel}"
  danger: "{colors.rust}"
  warning: "{colors.ochre}"
  positive: "{colors.mint-deep}"
  focus: "{colors.mint-deep}"
  focus-on-dark: "{colors.mint}"
  debit: "{colors.cobalt}"
  credit: "{colors.gold}"
  border-google: "{colors.pewter}"
  google-blue: "{colors.azure}"
  google-green: "{colors.leaf}"
  google-yellow: "{colors.amber}"
  google-red: "{colors.scarlet}"
typography:
  display:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: 600
    lineHeight: 40px
    letterSpacing: -0.01em
  h1:
    fontFamily: Sora
    fontSize: 28px
    fontWeight: 600
    lineHeight: 36px
    letterSpacing: -0.01em
  h2:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
  body:
    fontFamily: Sora
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  body-dense:
    fontFamily: Sora
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: DM Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.06em
  figure:
    fontFamily: DM Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    fontFeature: '"tnum" 1'
  date:
    fontFamily: DM Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    fontFeature: '"tnum" 1'
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  button-quiet-on-dark:
    textColor: "{colors.text-muted-on-dark}"
  button-quiet-on-dark-hover:
    textColor: "{colors.text-on-dark}"
  link:
    textColor: "{colors.accent-text}"
  link-hover:
    textColor: "{colors.accent-text-hover}"
  sidebar:
    backgroundColor: "{colors.ground-dark}"
    textColor: "{colors.text-on-dark}"
  sidebar-link:
    textColor: "{colors.text-muted-on-dark}"
  sidebar-item-active:
    backgroundColor: "{colors.ground-dark-raised}"
    textColor: "{colors.text-on-dark}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  button-google:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  sign-in-card:
    backgroundColor: "{colors.surface}"
---

# Credebi design

This file governs how Credebi looks. The values above are the design; the file
that holds them for the code is `packages/ui/src/tokens.ts`. The global
stylesheet, `apps/web/app/globals.css`, declares the same values in Tailwind's
`@theme`, and a unit test fails when the two differ. So does one when a declared
colour pair falls below its contrast minimum. A value changes in the tokens
module, the stylesheet and here, in one pull request.

The stylesheet resets Tailwind's colours to `initial`, so the tokens are the
only colour utilities that exist, and the lint rule `repo/no-raw-color` rejects
a colour literal, or a class naming a colour that is not a semantic token,
anywhere in `apps/web` or `packages/ui` outside the tokens module and the tests
of the tokens and contrast modules. The rule reads the token names from the
tokens module.

Only the light theme exists. A dark theme is deferred to a Feature of its own,
and until then no token has a dark mapping.

## Overview

Credebi is a double-entry bookkeeping app for one person keeping their own
books. It should feel calm and exact: a cool, mint-tinted light ground, deep
ink for text, and mint used sparingly, for the mark, the primary action and
text that must stand out. Figures and dates are set in a monospaced face so
columns of amounts line up. Nothing is decorative at the cost of legibility:
every text colour meets WCAG AA against every ground it is read on.

## Colors

Colours come in two layers.

The **brand palette** is the set of named colours. Nothing in a component names
a palette colour.

| Palette       | Value     | What it is for                             |
| ------------- | --------- | ------------------------------------------ |
| `mint`        | `#2FD0A2` | the mark, the primary button fill           |
| `mint-deep`   | `#0B7A5E` | mint as text on a light ground, focus ring |
| `mint-deeper` | `#09644D` | link hover                                 |
| `ink`         | `#0B2B2A` | text, the Sidebar                          |
| `ink-raised`  | `#133F3C` | a raised dark surface, the active Sidebar item |
| `mist`        | `#F2F8F5` | the page ground                            |
| `frost`       | `#EAF7F2` | text on ink                                |
| `white`       | `#FFFFFF` | panels                                     |
| `slate`       | `#4A6461` | muted text                                 |
| `sage`        | `#9FC4BC` | muted text on ink                          |
| `fog`         | `#E1ECE8` | dividers, panel edges                      |
| `steel`       | `#78948F` | control edges                              |
| `rust`        | `#B4400F` | danger                                     |
| `ochre`       | `#A15C00` | warning                                    |
| `cobalt`      | `#2B63B8` | Debit                                      |
| `gold`        | `#7F6500` | Credit                                     |
| `pewter`      | `#747775` | the Google sign-in button's edge           |
| `azure`       | `#4285F4` | the Google G, blue                         |
| `leaf`        | `#34A853` | the Google G, green                        |
| `amber`       | `#FBBC05` | the Google G, yellow                       |
| `scarlet`     | `#EA4335` | the Google G, red                          |

`mint-deep` was `#0E9A76`, which reads 3.6:1 on white and 3.3:1 on mist, below
AA for text. `#0B7A5E` reads 5.3:1 and 4.9:1.

`steel` was `#7E9994`, which reads 3.06:1 on white but 2.84:1 on mist. It is
darkened at the same hue and saturation to `#78948F`, which reads 3.27:1 on
white and 3.04:1 on mist, so a control edge clears 3:1 on both light grounds.

**Semantic tokens** name a role and map it onto the palette. Components use only
these, as Tailwind utilities such as `bg-surface`, `text-text-muted` or
`border-border-control`.

| Semantic token       | Palette     | Role                                  |
| -------------------- | ----------- | ------------------------------------- |
| `surface`            | `white`     | panels                                |
| `ground`             | `mist`      | the page background                   |
| `text`               | `ink`       | body text, headings                   |
| `text-muted`         | `slate`     | labels, hints, dates                  |
| `text-on-dark`       | `frost`     | text in the Sidebar                   |
| `text-muted-on-dark` | `sage`      | links in the Sidebar                  |
| `ground-dark`        | `ink`       | the Sidebar's ground                  |
| `ground-dark-raised` | `ink-raised` | the active Sidebar item              |
| `accent`             | `mint`      | the primary button fill, the mark     |
| `accent-text`        | `mint-deep` | links, accent text on a light ground  |
| `accent-text-hover`  | `mint-deeper` | a link under the pointer            |
| `border`             | `fog`       | dividers, panel edges                 |
| `border-control`     | `steel`     | inputs, secondary buttons             |
| `danger`             | `rust`      | refusals, errors                      |
| `warning`            | `ochre`     | a degraded health status              |
| `positive`           | `mint-deep` | a healthy status, a saved confirmation |
| `focus`              | `mint-deep` | the 2px focus ring on a light ground  |
| `focus-on-dark`      | `mint`      | the 2px focus ring on a dark ground   |
| `debit`              | `cobalt`    | a Debit amount or label               |
| `credit`             | `gold`      | a Credit amount or label              |
| `border-google`      | `pewter`    | the Google sign-in button's edge      |
| `google-blue`        | `azure`     | the Google G's blue arc               |
| `google-green`       | `leaf`      | the Google G's green arc              |
| `google-yellow`      | `amber`     | the Google G's yellow arc             |
| `google-red`         | `scarlet`   | the Google G's red arc                |

`debit` and `credit` back up position, Debit on the left and Credit on the
right; they never carry a Side alone. Neither is green or red, so neither reads
as gain or loss. `credit` is a dark gold, not an amber, so it stays clearly
apart from `warning`'s ochre (ΔE76 21.5) and `danger`'s rust (ΔE76 43): a
Credit amount never reads as a warning. As text, `debit` reads 5.87:1 on
`surface` and 5.45:1 on `ground`; `credit` reads 5.58:1 on `surface` and 5.19:1
on `ground`.

`pewter`, `azure`, `leaf`, `amber` and `scarlet` are Google's, not Credebi's:
Google's sign-in branding fixes the button's edge and the four colours of its
G, so they are kept exactly and used nowhere else. The G's colours are a mark's
fills, not text or edges, and carry no contrast pair.

The tokens module declares the pairs that must meet a contrast minimum, and a
unit test checks every one:

- **Text, 4.5:1.** `ink`, `slate`, `mint-deep`, `mint-deeper`, `rust`,
  `ochre`, `cobalt` and `gold` on `white` and on `mist`; `frost` and `sage` on
  `ink` and on `ink-raised`, which is `text-on-dark` and `text-muted-on-dark` on
  `ground-dark` and `ground-dark-raised`; `ink` on `mint`.
- **Control edges, 3:1.** `steel` and `mint-deep` on `white` and on `mist`;
  `mint`, the `focus-on-dark` ring, on `ink` and on `ink-raised` (7.66:1 on
  `ink`); `pewter`, the Google sign-in button's edge, on `white` (4.53:1).

A new text colour or ground is added to these pairs in the same change.

## Typography

Headings and body text are set in **Sora**: SemiBold for headings, Regular for
reading. Labels, figures and dates are set in **DM Mono** Regular, so every
column of amounts lines up. Nothing is set below 12px.

| Step      | Face             | Size / line height | Letter spacing | Also             |
| --------- | ---------------- | ------------------ | -------------- | ---------------- |
| `display` | Sora SemiBold    | 32 / 40            | -0.01em        |                  |
| `h1`      | Sora SemiBold    | 28 / 36            | -0.01em        |                  |
| `h2`      | Sora SemiBold    | 20 / 28            |                |                  |
| `body`    | Sora Regular     | 15 / 24            |                |                  |
| `body-sm` | Sora Regular     | 14 / 20            |                |                  |
| `body-dense` | Sora Regular  | 13 / 20            |                |                  |
| `label`   | DM Mono Regular  | 12 / 16            | 0.06em         | capitals         |
| `figure`  | DM Mono Regular  | 14 / 20            |                | tabular numerals |
| `date`    | DM Mono Regular  | 13 / 20            |                | tabular numerals |

Each step is a Tailwind `text-<step>` utility, which sets its size, line height,
weight and letter spacing. The face, the capitals and the tabular numerals are
applied beside it: `font-sans` is Sora and the page's default, `font-mono` is DM
Mono, `uppercase` sets the capitals and `tabular-nums` the numerals.
`typeClasses` in `packages/ui/src/type-classes.ts` holds each step's full set,
and a component takes a step from it: a date, shown or typed, is
`typeClasses.date`, an amount `typeClasses.figure`, and a section label
`typeClasses.label`. `body-dense` is the entry form's step, so the form stays
short. The fonts are served from the
repository, never fetched from a font service at build or run time. The font
files and their OFL licences are in `apps/web/app/fonts/`: the pages load the
woff2 files through `next/font/local`, and the share image reads Sora as TTF, as
"Metadata files" in `docs/ARCHITECTURE.md` states.

## Layout

The design has one breakpoint, `wide`, at 720px. The stylesheet declares it as
`--breakpoint-wide: 45rem`, which is 720px at the root's 16px and is in rem like
Tailwind's own breakpoints, so they sort together. `breakpoints` in the tokens
module holds it, and the utilities take it as the `wide:` variant: a style
written bare is the narrow layout, and `wide:` sets the layout from 720px up.
The stylesheet resets `--breakpoint-*` to `initial`, as it does the colours, so
Tailwind's default breakpoints do not exist and `wide` is the only one.

Below `wide` the page gutter is 16px and a panel sits directly in it, with no
box nested inside the panel; from `wide` up the gutter is 32px.

## Elevation & Depth

Hierarchy comes from tonal layers, not shadows: `surface` panels with a
`border` edge sit on the `ground`, and the Sidebar is the one dark layer.

## Components

- **Primary button.** `accent` fill with `text`. White on mint reads 2.0:1 and
  is never used. It is kept for a page's main action: the entry form's submit
  and Entry search's submit. Every other button on a light ground is
  secondary, except the Google sign-in button. A transparent edge as wide as an Input's border
  makes it as tall as the Input it sits beside: Entry search's submit beside
  the memo field, and the entry form's submit beside the amount field in
  Two-line mode.
- **Secondary button.** `surface` fill, `text`, a `border-control` edge.
- **Google sign-in button.** "Sign in with Google" follows Google's sign-in
  branding rather than the primary button: a `surface` fill, `text`, a
  `border-google` edge, 40px tall and as wide as the Sign in card, with Google's
  four-colour G, 18px, before its text. The G is hidden from assistive
  technology, so the button's name is its text alone.
- **Sign in card.** The sign-in page's one panel, centred on the `ground` both
  ways. It is the panel's look, as `PANEL` in `packages/ui` draws it, with
  roomier padding: 400px wide and 40px of padding from `wide` up; below `wide`
  as wide as the page gutter allows, with 28px above and below and 20px at the
  sides. Inside, 24px apart: the stacked Lockup, the `Sign in` heading (an `h1`
  element set in the `h2` step, centred), the failure line when sign-in failed,
  centred, the Google sign-in button, and, where test sign-in is offered, the
  `Test sign-in` form below a dashed `border` rule with 20px above it.
- **Quiet button on dark.** No fill and no border: `text-muted-on-dark` text,
  `text-on-dark` under the pointer, and the `focus-on-dark` ring. It is Sign out
  in the Sidebar, an exit icon in `currentColor` before its text.
- **Icon button on dark.** No fill and no border: a 40px square holding a
  stroke icon in `text-on-dark`, with the `focus-on-dark` ring and an accessible
  name in place of text. It is `Menu`, a hamburger icon, in the bar that opens
  the Sidebar drawer.
- **Segmented control.** A radiogroup drawn as one `surface` strip with a
  `border-control` edge, each choice a segment. Only the chosen segment is
  marked: an `accent` tint and the semibold weight. It is the Entry form mode in
  Settings, where each segment fills an equal share of the strip and stacks a
  decorative drawing of the mode over its name and a one-line description in
  `body-dense`. The drawing is rounded 4px bars, 72px wide at most: Two-line is
  two equal bars, one `debit` over one `credit`; Multi-line is four of varying
  length, two `debit` then two `credit`.
- **Settings row.** Settings has no panel: each setting is a row between
  `border` hairlines, its name on the left and its control on the right, and
  stacked below `wide`.
- **Date presets.** A row of secondary buttons, `Year`, `Quarter`, `Month`
  and `Relative`, below a `border` hairline at the foot of the Entry search
  form, from `wide` up. Each opens its choices on hover in a `surface` panel
  with a `border` edge and no shadow, one row per year, scrolled to the year of
  today. The year, quarter and month that hold today are set in `accent-text`,
  semibold and underlined in `accent`; a Relative choice never is. No choice is
  marked as chosen: From and To state the range. Below `wide` the row is not
  shown: a secondary button holding a calendar icon, named `Choose a period`,
  sits beside From and To and opens the presets as a full-screen modal dialog on
  the `ground`. The button is square and as tall as From and To: it keeps an
  Input's edge and vertical padding, pads its sides by that same amount, and
  its icon is as tall as an Input's line. A `surface` bar holds its title and a
  close icon, and below it the four categories are tabs, the shown one
  underlined in `accent` and set in `accent-text`, semibold. Each tab lists its
  choices as the panel does, with each year above its row; choosing one closes
  the sheet. Escape or the close icon closes it without choosing, and focus
  returns to the button.
- **Account sheet.** From `wide` up the Accounts to choose from sit right of the
  entry form, Debit and Credit side by side. Below `wide` they leave the form
  and open `Choose accounts` as a modal dialog rising from the foot of the page
  to 64px below its top, on the `ground` over a `ground-dark` scrim at 60%. In
  Multi-line mode each Side opens it with `Add debit account` or
  `Add credit account`, a text button in the Side's colour after a `+`. In
  Two-line mode each Side's row is itself one full-width button, named
  `Choose debit account` or `Choose credit account`: the Side in `label` and the
  Side's colour, then `Choose an account` in `text-muted` while it has none, or
  the Account's name, semibold, and a chevron icon at the row's end once it has
  one. A `surface` bar holds the sheet's title and, in Multi-line mode, `Done`,
  a primary button, or in Two-line mode the close icon, as the Date presets
  sheet's; below it Debit and Credit are tabs drawn as the Date presets sheet's,
  then a `Find an account` search field, then the shown Side's Accounts grouped
  by Account type, narrowed to those whose name holds the text typed, or
  `No account matches` and the text when none does. The tab names the Side, so
  no Side heading is shown above the Accounts, though each column from `wide` up
  keeps one. In Two-line mode, choosing an Account on one Side while the other
  has none shows the other Side's tab, and a choice that leaves both Sides with
  an Account closes the sheet; in Multi-line mode ticking an Account keeps the
  tab. `Done` or the close icon, Escape or a click on the scrim closes it, and
  focus returns to the button that opened it.
- **Entry form dividers.** In both Entry form modes a `border` hairline runs
  under Date and Memo, before the Accounts. In Multi-line mode the lines of one
  Side are divided by dashed `border` hairlines, and a solid one closes each
  Side below its `+ Add … account`, separating Debit from Credit; from `wide`
  up, where that button is not shown, it sits under the Side's last line, and a
  Side with no line draws none.
- **Multi-line line.** Two columns at all widths, about 6:4, the Account's the
  wider: the left stacks the Side, in `label` and the Side's colour, over the
  Account name, semibold and wrapping; the right holds the amount field and,
  beside it, the Remove icon button.
- **Icon button.** A secondary button holding a stroke icon in place of text,
  with an accessible name: square and as tall as the Input beside it, as
  `Choose a period` is. It is `Remove`, a trash icon, on each Multi-line line.
- **Link.** `accent-text`, underlined, and `accent-text-hover` under the
  pointer.
- **Input.** `surface` fill, `text`, a `border-control` edge. The spec's
  component properties have no border colour, so the edge is stated here only.
  A date Input drops the browser's own drawing, so it is as tall as the text
  Input beside it: the entry form's Date beside Memo, and Entry search's From
  and To.
- **Sidebar.** Dark: a `ground-dark` ground, `text-on-dark` text,
  `text-muted-on-dark` links, and the active item on `ground-dark-raised`. The
  logo there is the horizontal Lockup in the reverse tone. Sign out sits at the
  foot, below a `ground-dark-raised` hairline; from `wide` up the Sidebar is as
  tall as the viewport and stays in place as the page scrolls. Below `wide` it is
  a drawer: a `ground-dark` bar holds `Menu` at its left and the logo after it,
  and `Menu` opens the Sidebar as a modal dialog on the page's left edge over a
  `ground-dark` scrim at 60%.
  The bar's logo hides while it is open, so one logo shows. Escape, a click on
  the scrim or following a link closes it, and focus returns to `Menu`.
- **Focus.** A 2px ring on every focusable element: `focus` on a light ground,
  `focus-on-dark` on a dark one.
- **Status.** `positive` for healthy, `warning` for degraded, `danger` for a
  refusal or an error.

## Logo

The Mark is the A1 "Offset Split Coin": a coin split down the middle. The left
half is a C-shaped ring; the right half is a solid half-disc in `mint`. The two
halves stand apart by a vertical gap and are offset vertically, the left half
lower and the right half higher.

**Tones.**

| Tone      | Ground          | Left half | Right half | Wordmark | C and d     |
| --------- | --------------- | --------- | ---------- | -------- | ----------- |
| `color`   | a light ground  | `ink`     | `mint`     | `ink`    | `mint-deep` |
| `reverse` | `ink`           | `frost`   | `mint`     | `frost`  | `mint`      |
| `mono`    | a light ground  | `ink`     | `ink`      | `ink`    | `ink`       |

In the `mono` tone every part is `ink`, the `text` token: one colour
throughout.

**Lockups.** `mark` alone; `horizontal`, the Mark left of the Wordmark;
`stacked`, the Mark above the Wordmark. The Sidebar uses the horizontal Lockup
in the reverse tone, and the sign-in page the stacked Lockup in the colour tone.

**Clear space.** x is the thickness of the C ring, about 0.2 of the Mark's
height. Keep at least x clear on every side of the Mark or a Lockup.

**Gap.** In the horizontal Lockup, the gap between the Mark and the Wordmark is
1.5x.

**Minimum sizes.** The Mark 16px on screen, 6mm in print. The horizontal Lockup
80px wide on screen, 20mm in print.

**Don'ts.** Never stretch the logo, recolour it outside its tones, close the gap
or the offset between the halves, or rotate it.

The logo is one image named "Credebi" to assistive technology; its parts are
hidden.

## Do's and Don'ts

- Do use a semantic token for every colour; never a palette colour, a Tailwind
  palette class or a colour literal in a component.
- Do add a new text/background pair to the tokens module when a new pairing
  appears, so the contrast test checks it.
- Do use `accent-text`, never `accent`, for mint text on a light ground.
- Do set figures and dates in DM Mono with tabular numerals.
- Don't set text below 12px.
- Don't add a dark mapping before the dark theme Feature.

## Terms

| Term           | Meaning |
| -------------- | ------- |
| Mark           | The Credebi symbol alone, the offset split coin, without any lettering. |
| Wordmark       | The name "Credebi" set as outlined Sora SemiBold, with C and d in the accent colour of its tone. |
| Lockup         | A fixed arrangement of the Mark and the Wordmark: horizontal or stacked. The Mark alone is also a variant of the logo. |
| Semantic token | A colour named by its role, such as `text-muted` or `danger`, mapped onto a brand palette colour. Components use only these. |
