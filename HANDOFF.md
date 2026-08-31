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
