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

The tokens module declares the pairs that must meet a contrast minimum, and a
unit test checks every one:

- **Text, 4.5:1.** `ink`, `slate`, `mint-deep`, `mint-deeper`, `rust` and
  `ochre` on `white` and on `mist`; `frost` and `sage` on `ink` and on
  `ink-raised`, which is `text-on-dark` and `text-muted-on-dark` on
  `ground-dark` and `ground-dark-raised`; `ink` on `mint`.
- **Control edges, 3:1.** `steel` and `mint-deep` on `white` and on `mist`;
  `mint`, the `focus-on-dark` ring, on `ink` and on `ink-raised` (7.66:1 on
  `ink`).

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
`typeClasses.label`. The fonts are served from the
repository, never fetched from a font service at build or run time. The font
files and their OFL licences are in `apps/web/app/fonts/`: the pages load the
woff2 files through `next/font/local`, and the share image reads Sora as TTF, as
"Metadata files" in `docs/ARCHITECTURE.md` states.

## Elevation & Depth

Hierarchy comes from tonal layers, not shadows: `surface` panels with a
`border` edge sit on the `ground`, and the Sidebar is the one dark layer.

## Components

- **Primary button.** `accent` fill with `text`. White on mint reads 2.0:1 and
  is never used. It is kept for a page's main action: the entry form's submit,
  Entry search's submit and "Sign in with Google". Every other button on a
  light ground is secondary.
- **Secondary button.** `surface` fill, `text`, a `border-control` edge.
- **Quiet button on dark.** No fill and no border: `text-muted-on-dark` text,
  `text-on-dark` under the pointer, and the `focus-on-dark` ring. It is Sign out
  in the Sidebar.
- **Link.** `accent-text`, underlined, and `accent-text-hover` under the
  pointer.
- **Input.** `surface` fill, `text`, a `border-control` edge. The spec's
  component properties have no border colour, so the edge is stated here only.
- **Sidebar.** Dark: a `ground-dark` ground, `text-on-dark` text,
  `text-muted-on-dark` links, and the active item on `ground-dark-raised`. The
  logo there is the horizontal Lockup in the reverse tone.
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
