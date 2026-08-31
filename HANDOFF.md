# Handoff

## 2026-08-31 - Cinematic Skyline v0.5.0

### Work summary

- Preserved the pre-existing Skyline motion and layout work as a dedicated baseline commit.
- Added `cinematic` as the default Skyline style and retained the previous presentation through `--skyline-style classic`.
- Added facade material gradients, edge lighting, floor bands, distant city layers, horizon glow and haze, atmospheric particles, richer clouds, vignette shading, and segmented water reflections.
- Kept token height, density, landmark, active-day, streak, deterministic rendering, local-only output, and reduced-motion behavior intact.
- Updated CLI help, README guidance, changelog, renderer tests, CLI validation, verification size budgets, and package version to `0.5.0`.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles, four sky phases, and full/compact layouts; largest SVG was 147,736 bytes.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.5.0` validated at 39,286 bytes packed and 130,248 bytes unpacked.
- Chromium visual QA completed for the full gallery and a 2x 90-day night metropolis render.

### Commits

- `6db69d7` - Refine skyline motion and card layout.
- `8810252` - Add cinematic skyline rendering and bump to v0.5.0.

### Blockers

- None.

## 2026-08-31 - Layered Skyline v0.5.1

### Work summary

- Replaced the cinematic skyline's flat secondary row with deterministic rear and middle districts derived from token activity, while keeping the primary daily buildings in the foreground.
- Added overlapping lot placement, depth-specific height and density sampling, atmosphere, glass sheen, podiums, shadows, and subtle grain so small foreground buildings can sit naturally in front of taller towers.
- Preserved the `classic` single-plane style and zero-token behavior.
- Audited Codex ingestion: Token Stack currently counts Codex sessions only. Recent local rollout files do expose token-count events, but Codex token totals are not yet included in the summary, models, or skyline.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles; largest SVG was 178,773 bytes.
- `npm run verify:pack`: packed, installed, and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.5.1` validated at 41,220 bytes packed and 138,136 bytes unpacked.
- Chromium visual QA completed for dawn, day, dusk, night, empty, compact, and current 30-day activity renders.

### Commits

- `f7d821c` - Render token activity as layered city districts.

### Blockers

- None for the skyline release. Codex token ingestion remains a separate follow-up because its supported log schema and aggregation semantics need to be defined.

## 2026-08-31 - Reflected Waterfront Skyline v0.5.2

### Work summary

- Used the supplied real waterfront skyline photograph as a composition reference without embedding or copying the raster image.
- Increased the cinematic city's horizontal density with narrower overlapping rear, middle, and foreground buildings plus more detailed district faces.
- Kept a waterfront plane in every cinematic sky phase and mirrored the complete data-derived city into it using deterministic SVG displacement, vertical blur, and depth fade.
- Added a textured shoreline and irregular ripples, while reducing the daylight sun, cloud, and grain emphasis for a more architectural presentation.
- Preserved the local-only, deterministic renderer, the token-height semantics, and the `classic` style.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles; largest SVG was 214,666 bytes.
- `npm run verify:pack`: packed, installed, and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.5.2` validated at 42,309 bytes packed and 142,247 bytes unpacked.
- Chromium visual QA completed against the full phase/profile gallery, including daylight and dusk mirrored-waterfront cases.

### Commits

- `943c49c` - Render a reflected waterfront skyline.

### Blockers

- None for the skyline release. Pure procedural SVG can reproduce the reference's density, depth, and reflection composition, but not literal photo-level pixels without embedding a raster asset.

## 2026-08-31 - Ambient Skyline Motion v0.5.3

### Work summary

- Added long-running ambient motion that continues after the skyline construction reveal finishes.
- Added independently timed glints to a sparse deterministic subset of lit dusk and night windows; a 30-day metropolis rendered 15 dusk and 17 night glints rather than animating every window.
- Added independently timed horizontal drift and opacity changes to eight irregular waterfront ripple paths in the full card across every sky phase.
- Retained the existing slow star twinkle, daylight cloud drift, and haze motion without animating city geometry or the reflected building mass.
- Explicitly disabled window, water, cloud, haze, and star ambient motion under `prefers-reduced-motion`; `--no-anim` emits no ambient keyframes or per-element timing.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles; largest SVG was 214,898 bytes.
- `npm run verify:pack`: packed, installed, and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.5.3` validated at 42,790 bytes packed and 143,977 bytes unpacked.
- Automated checks bound independently animated windows to 24 full / 12 compact and verify 7.5-13.1 second glint timing.

### Commits

- `157e2db` - Keep the skyline subtly animated.

### Blockers

- None.

## 2026-08-31 - Realistic Atmospheric Depth v0.5.4

### Work summary

- Audited the supplied live daylight card and identified equal layer sharpness, saturated teal materials, repeated rounded crowns, uniform bright windows, cartoon-like sky accents, and an overly broad reflection as the main sources of the futuristic look.
- Replaced cinematic daylight with neutral glass, concrete, stone, and muted sky colors, plus lower daylight window density and facade-grid contrast.
- Replaced rounded mid-rise and high-rise silhouettes with rectilinear setbacks and flat rooflines.
- Lowered and desaturated rear/middle districts, reduced secondary high-rise frequency, and added separate rear/middle Gaussian depth filters with an intervening haze plane.
- Reduced cinematic water depth, daylight reflection strength, sun size, and cloud opacity while preserving the ambient animation and token-bearing foreground.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles; largest SVG was 216,153 bytes.
- `npm run verify:pack`: packed, installed, and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.5.4` validated at 43,079 bytes packed and 145,677 bytes unpacked.
- Chromium visual QA completed for the full phase/profile matrix and the live 6.64B-token, 30-day daylight card.

### Commits

- `e841a11` - Ground the skyline in realistic depth.

### Blockers

- None.

## 2026-08-31 - Architectural Activity Districts v0.6.0

### Work summary

- Replaced evenly distributed skyline density with one to five deterministic activity clusters derived from the selected token window; the same history still reproduces the same city.
- Added glass, office, residential, masonry, and civic foreground architecture with type-specific roof profiles, facade divisions, balconies, cornices, and mechanical bands.
- Added two-to-six tapered reflection segments per eligible foreground building and reduced the opacity of the broad reflected city mass.
- Reworked the full Activity card header into labeled `TOKENS`, `EST. COST`, and `WINDOW` values.
- Reworked the lower panel into a two-level visual key for building height/daily tokens, city density/active days, and green route/current streak.
- Preserved compact output, `classic` rendering, deterministic geometry, construction animation, ambient motion, and reduced-motion behavior.

### Verification

- `npm test`: 41 tests passed.
- `npm run verify:skyline`: 88 static reference renders passed across 11 profiles and four sky phases; largest recorded SVG was 243,859 bytes.
- `npm run verify:pack`: package installed and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.6.0` validated at 44,819 bytes packed and 153,307 bytes unpacked.
- Chromium visual QA completed for the live 6.64B-token, 25/30-active-day daylight card, including the labeled header, explanatory lower panel, clustered skyline, architecture details, and water reflections.

### Commits

- `144babc` - Compose architectural activity districts.

### Blockers

- None for v0.6.0. Codex still contributes session counts to the `agents` card but not token totals to token-based cards; adding Codex token ingestion remains a separate data-model feature.

## 2026-08-31 - Codex Metrics and Custom City Life v0.7.0

### Work summary

- Added Codex token ingestion across `$CODEX_HOME/sessions`, `~/.codex/sessions`, and sibling archives, with cumulative-delta handling, cache-subset normalization, reset recovery, copied-snapshot de-duplication, model/cwd tracking, and provider-scoped history merges.
- Kept Codex product telemetry unpriced; mixed cards and terminal stats now identify the dollar value as a Claude-only estimate.
- Added `--city-palette natural|graphite|copper|evergreen`, `--city-base waterfront|park|transit`, and `--city-motion auto|off`, preserving `natural + waterfront` as the default composition.
- Added metric-driven street life: recent sessions determine up to five vehicles and active-project breadth determines up to five pedestrians. The full legend, SVG metadata, accessible description, and reduced-motion rules expose and explain these signals.
- Refreshed tracked cards with live Claude Code + Codex aggregates, added a four-variant visual gallery, and replaced the outdated social preview with a reproducible HTML/CSS composition using the current Activity card.
- Updated README positioning, provider/cost caveats, customization examples, npm search keywords, and the v0.7.0 changelog.

### Verification

- `npm test`: 49 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles and four phases; largest SVG was 244,075 bytes.
- `npm run verify:city`: four palette/base combinations rendered and passed Chromium visual QA.
- `npm run verify:pack`: packed install and CLI execution passed from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.7.0` validated at 49,726 bytes packed and 172,818 bytes unpacked.
- Real local Codex scan: 25,004 token events across 38 sessions produced 3.09B additive tokens without pricing; the large first scan completed in about 43 seconds.
- Live Activity visual QA: 7.98B tokens in the 30-day window, `CLAUDE EST.` cost label, 25/30 active days, 56 recent sessions, three active projects, five vehicles, and four pedestrians rendered cleanly.

### Commits

- `4876105` - Add Codex metrics and customizable city life.

### Blockers

- OpenAI's public documentation does not specify the local Codex rollout JSONL schema, so compatibility is fixture- and real-log-tested rather than guaranteed as a public API contract.
- GitHub does not automatically use `assets/social-preview.png` as repository metadata; upload the refreshed image once under repository Settings → Social preview.

## 2026-08-31 - Motion Override and Grass Restore v0.7.1

### Work summary

- Traced the apparently frozen profile card to the host Windows animation setting (`MinAnimate=0`), which makes browsers match `prefers-reduced-motion: reduce` and correctly triggered the SVG's accessibility stop rule.
- Added `--motion-policy system|always`: `system` remains the accessible default, while `always` omits the reduced-motion media rule for explicitly animated published cards.
- Regenerated the full-width Activity Skyline with forced motion so traffic, pedestrians, water, and atmosphere keep moving on the current profile.
- Restored `token-stack-summary-compact.svg` to the distinct 119-day GitHub-style token grass grid instead of duplicating the city in both profile slots.

### Verification

- `npm test`: 51 tests passed.
- `npm run verify:skyline`: 88 renders passed across 11 profiles; largest SVG was 244,075 bytes.
- `npm run verify:city`: four palette/base variants rendered successfully.
- `npm run verify:pack`: package installed and executed successfully from a spaced Unicode path.
- `npm pack --dry-run --json`: package `@sukojin/token-stack@0.7.1` validated at 50,098 bytes packed and 174,017 bytes unpacked.
- Live assets verified structurally: Activity contains the Skyline and traffic keyframes without a reduced-motion override; compact summary contains 119 grass cells and no city metadata.

### Commits

- `60e8077` - Fix profile motion and restore token grass.

### Blockers

- None.
