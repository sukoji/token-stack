# Changelog

## 0.7.0

- Ingest Codex `token_count` rollouts into token-based cards with cumulative-delta handling, cache-subset normalization, reset recovery, copied-snapshot de-duplication, and provider-scoped history merging.
- Discover both `$CODEX_HOME/sessions` and `~/.codex/sessions`, including archived rollouts, while retaining `--codex-source` as an explicit override.
- Keep Codex usage unpriced and label mixed-card dollar values as `CLAUDE EST.` rather than presenting an API estimate as a subscription charge.
- Add composable `natural`, `graphite`, `copper`, and `evergreen` city palettes plus `waterfront`, `park`, and `transit` foregrounds.
- Derive restrained vehicles from recent sessions and pedestrians from active-project breadth, expose those signals in the Skyline legend and SVG metadata, and support `--city-motion off` plus reduced-motion preferences.
- Add a reusable city-options visual gallery and cross-provider, city-composition, mobility, CLI, history, and rendering regression coverage.
- Refresh tracked example cards and the reproducible 1200×630 social preview around the Claude Code + Codex positioning and current `npx` workflow.

## 0.6.0

- Compose one to five deterministic activity clusters from the selected token window so the rear, middle, and foreground layers form recognizable districts instead of an evenly distributed row.
- Give foreground buildings glass, office, residential, masonry, or civic architecture with type-specific roof profiles, facade lines, balconies, cornices, and mechanical bands.
- Extend foreground buildings into individually segmented, tapered water reflections while reducing the opacity of the broad reflected city mass.
- Redesign the Activity Skyline header as labeled `TOKENS`, `EST. COST`, and `WINDOW` metrics.
- Redesign the lower legend as a two-level visual key for `BUILDING HEIGHT / DAILY TOKENS`, `CITY DENSITY / ACTIVE DAYS`, and `GREEN ROUTE / CURRENT STREAK`.
- Preserve deterministic output, the existing token-height semantics, reduced-motion behavior, compact mode, and the `classic` renderer.

## 0.5.4

- Replace the saturated cinematic daylight palette with neutral glass, concrete, stone, and muted sky colors.
- Replace repeated rounded mid-rise and high-rise crowns with rectilinear setbacks and flat architectural rooflines.
- Reduce daylight window density, brightness, facade grids, cloud prominence, sun size, and mirrored-water intensity.
- Add separate rear and middle depth filters plus a near-horizon haze plane so only the data-bearing foreground stays fully sharp.
- Lower and desaturate secondary districts while preserving foreground token-height contrast and the `classic` rendering path.

## 0.5.3

- Keep animated cinematic cities subtly alive after construction completes.
- Let only a sparse deterministic subset of lit dusk and night windows dim and recover on independent 10-13 second cycles, alongside the existing slow star twinkle.
- Drift waterfront ripple strokes on independent 13-21 second cycles in every sky phase, complementing the existing restrained daylight cloud movement.
- Disable window, water, cloud, haze, and star ambient motion under `prefers-reduced-motion`, while `--no-anim` remains fully static.

## 0.5.2

- Recompose the cinematic Skyline as a denser waterfront city inspired by real horizontal skylines, with narrower overlapping towers and a continuous low-rise streetwall.
- Keep water present across cinematic dawn, day, dusk, and night so the city reads as one coherent waterfront scene instead of switching composition by time of day.
- Mirror the complete data-derived city into the water with a deterministic displacement filter, vertical blur, depth fade, ripples, and a textured shoreline.
- Reduce cartoon-like daylight cloud and sun emphasis while retaining the four time-of-day palettes and local-only SVG output.
- Verify up to 50 foreground and 64 district buildings within a 240 KB full / 82 KB compact SVG budget across the 88-render matrix.

## 0.5.1

- Turn each sampled token interval into a deterministic city district instead of presenting the primary buildings as a single flat row.
- Add separate rear and middle depth planes with overlapping, activity-derived secondary buildings behind the token-height foreground.
- Refine cinematic daylight with deeper glass and concrete palettes, directional facade shading, silhouette rims, podiums, sun glow, city-depth haze, building shadows, and subtle SVG grain.
- Keep empty histories free of decorative district buildings and retain the `classic` palette and single-plane presentation.
- Verify both depth planes, bounded district counts, and a 190 KB full / 68 KB compact animated SVG budget across the existing 88-render matrix.

## 0.5.0

- Make the new cinematic Skyline the default while preserving the previous look with `--skyline-style classic`.
- Add material-aware facade gradients, edge lighting, horizontal floor bands, and richer warm/cool window depth.
- Add distant city layers, horizon glow and haze, atmospheric particles, softer clouds, a scene vignette, and segmented waterfront reflections.
- Keep cinematic output deterministic, local-only, reduced-motion safe, and bounded to a verified 155 KB full-card / 58 KB compact-card budget.
- Preserve the existing token-to-height, density, landmark, active-day, and streak semantics across both visual styles.

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
