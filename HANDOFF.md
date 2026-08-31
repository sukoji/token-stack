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
