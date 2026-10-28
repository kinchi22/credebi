# ADR-0030: Draw charts with Recharts

**Status:** Accepted
**Date:** 2026-10-28

## Problem

The Assets and liabilities trend (#551) is the app's first chart: three monthly
lines with a dot on every month, a zero line, a tooltip and a legend that hides
and shows each line. It is not the last. The reports already in the app invite
others: a stacked area of what makes up the assets over time, monthly revenue and
expense as bars, the share of each expense Account, and possibly a flow from
revenue into expense.

The app has no charting dependency, and drawing each of those by hand in SVG
would mean writing scales, axes, ticks, curves, hit-testing and keyboard
navigation again for each kind of chart. #551 also requires chart values to be
reachable without relying on sight alone, so a chart has to be navigable by
keyboard and show its values as text.

The candidates were checked on 2026-10-28:

- `recharts` 3.10.1, released 2026-10, React components that render SVG,
  covering lines, areas, bars, pies, treemaps and Sankey flows, with keyboard
  navigation of a chart's points (`accessibilityLayer`) on by default.
- `@nivo/line` 0.99.0, last released 2025-05, SVG or canvas, the most polished
  defaults of the four, with no keyboard navigation in its line chart.
- `echarts`, the most chart types, drawn on canvas.
- `chart.js`, small, drawn on canvas, with Sankey flows from a plugin.

The prototype on `prototype/assets-and-liabilities-trend` drew the trend with
Recharts in three layouts and settled the look in #551: monotone lines, a dot on
every month that grows and gains a white outline under the pointer, a
horizontal grid, a dashed zero line, a tooltip card, and a legend below the
chart that toggles its lines.

## Decision

**Every chart in the app is drawn with `recharts` 3, a dependency of
`apps/web`.** No other charting library is added, and no chart is drawn in
hand-written SVG.

**A chart is a client component and receives its data already computed.** What
a point's value is, such as a month's total assets, is decided in `domain/` and
reaches the chart through the existing read path. The chart decides only how the
values are drawn.

**A chart's colours are Semantic tokens**, passed as `var(--color-...)`, never a
literal colour, so a chart follows `docs/DESIGN.md` as the rest of the page does.
Two series never differ by colour alone: they differ by a stroke pattern or a
label as well.

**The look every chart shares -- axes, grid, tooltip and dots -- is written once
in `apps/web/components/`, beside the first chart.** It moves into `packages/ui`
when a second chart reuses it, not before.

**A chart keeps Recharts' keyboard navigation and shows its values as text** in
its tooltip, and its data is also present in the page as text a screen reader
reads.

## Consequences

Recharts brings its own dependencies, `@reduxjs/toolkit`, `react-redux` and
`immer` among them, and `react-is` as a peer of the app. The JavaScript of every
page that draws a chart grows by them.

Its defaults look plain. The look settled in #551 is reached through its own
API -- curve types, custom dots, tooltip content and SVG gradients -- so a
chart's code is longer than its defaults would need.

Recharts draws SVG, which grows slow with thousands of points. A monthly trend
over the longest range #551 allows has 600 points per line, within what it
draws comfortably. A chart of daily values over years would need its data
reduced first.

## Rejected alternatives

**nivo.** Its defaults are the most polished, but it had gone 17 months without a
release, and its line chart has no keyboard navigation, which #551 requires.

**ECharts and Chart.js.** Both draw on canvas, so a chart's colours cannot be
Semantic tokens in CSS without reading them out in script, and a point is not an
element a keyboard or screen reader reaches.

**visx.** Low-level pieces that leave each chart's axes, tooltip and keyboard
navigation to be written, as hand-written SVG would.

**Hand-written SVG.** Enough for one line chart, but every further kind of
chart would add its own scales, hit-testing and keyboard navigation.
