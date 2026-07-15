# Changelog

## 0.4.17

- Make the full Skyline self-explanatory with a data-backed readout for daily token height, active-day coverage, and the current token streak green path.
- Add accessible Skyline descriptions while keeping compact cards visually clean.
- Derive Skyline cadence and streak only from the displayed token series, never from cross-provider session activity.
- Verify the readout and greenway across 88 skyline renders, including empty, zero-streak, short, long, and extreme windows.

## 0.4.16

- Add an 88-render Skyline verification matrix covering empty, sparse, bursty, sustained, heavy, long, and extreme histories in every sky phase and layout.
- Test packed installs from Unicode paths across the supported Node.js range on Ubuntu, Windows, and macOS.
- Isolate provider-only views and preserve Claude Code, Codex, and Antigravity session unions through rescans and legacy migrations.
- Serialize concurrent history writers, merge stale snapshots, retry transient Windows replacements, and preserve malformed history for recovery.
- Pin history day boundaries to the first recorded IANA timezone so travel or server moves cannot duplicate recent usage.
- Bound low-volume and short-history Skyline geometry, escape SVG metadata safely, and keep gallery previews isolated.
- Test Gist creation, updates, fallback file adds, failure cleanup, and correct npm follow-up commands.

## 0.4.0

- Add an opt-in Agent Passport share card with activity-derived archetypes.
- Keep `--card all` focused on the existing analytics cards.

## 0.3.0

- Auto-detect Codex and Antigravity local sessions.
- Base agent distribution on unique sessions, not incomparable provider token totals.
- Add provider-schema and activity aggregation regression tests.

## 0.2.4

- Use readable logarithmic summary bars by default, with a raw scale option.
- Show wide, responsive two-column, and compact layouts in the README gallery.

## 0.2.3

- Make the agent card compact for a single source and prevent bar/value overlap.

## 0.2.2

- Make the npm package the default Quick Start and hook command.

## 0.2.1

- Keep GitHub npx as the documented default until the npm publish secret is configured.

## 0.2.0

- Add npm publish and multi-version CI workflows.
- Add fixture-backed parser and SVG rendering tests.
- Add `init` for a copy-safe Claude hook and README setup flow.
- Add a privacy mode for JSON output and atomic history writes.
