# token-stack

**Private, shareable AI coding activity cards for your GitHub README — no server required.**

[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-3fb950?style=flat-square)](https://nodejs.org)
[![test](https://github.com/sukoji/token-stack/actions/workflows/test.yml/badge.svg)](https://github.com/sukoji/token-stack/actions/workflows/test.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-8b949e?style=flat-square)](./package.json)
[![npm](https://img.shields.io/npm/v/@sukojin/token-stack?style=flat-square)](https://www.npmjs.com/package/@sukojin/token-stack)

`token-stack` reads local Claude Code and Codex JSONL activity, aggregates the token fields each provider exposes, and renders animated SVG cards for a GitHub profile, project README, or blog. Your transcripts stay on your machine; only the SVG you choose to publish leaves it.

<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-summary.svg" width="495" alt="Token Stack wide summary card"/>
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-activity.svg" width="48%" alt="Token Stack activity card in two-column layout"/>
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-models.svg" width="48%" alt="Token Stack model card in two-column layout"/>
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-agents.svg" width="495" alt="Token Stack agent distribution card"/>
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-summary-compact.svg" width="340" alt="Compact Token Stack card"/>
</p>

## Quick start

```bash
# Create cards in the current directory
npx @sukojin/token-stack generate --card all

# Or create/update a Gist and print README embeds
npx @sukojin/token-stack sync --card all
```

Re-run `sync --gist <id>` to refresh the same public image URL everywhere it is embedded.

Prefer a global install? `npm install --global @sukojin/token-stack`, then use `token-stack` directly.

## Cards

| Card | What it shows |
|---|---|
| `summary` | All-time tokens, Claude API-cost estimate when available, streak, and an order-of-magnitude input/output/cache comparison |
| `activity` | Daily token activity for a selected window |
| `models` | Token share by model |
| `agents` | Session-based activity share across Claude Code, Codex, and Antigravity |
| `passport` | Optional share card that turns session activity into an AI-workflow archetype |

Use `--card all` to render every card. SVGs respect `prefers-reduced-motion`; pass `--no-anim` for fully static output.
Animated cinematic Skylines remain gently active after their construction reveal: dusk and night use sparse independently timed window glints and slow star twinkles, while every phase carries slow irregular water ripples and daylight retains restrained cloud drift. Ambient cycles are deliberately long and deterministic so the card feels alive without flashing.

`all` intentionally keeps the analytics set (`summary`, `activity`, `models`, `agents`). Passport is a separate opt-in card for people who want a more playful, shareable profile result.

## Agent Passport (optional)

<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-passport.svg" width="495" alt="Example Token Stack Agent Passport"/>
</p>

The Passport does not score productivity or reward token consumption. It assigns an activity-profile archetype from local, explainable signals: active agents, unique sessions, streak, and model variety. For example, three active providers produce `Multi-Agent Operator`; a balanced two-provider profile produces `Hybrid Builder`.

```bash
# Write a shareable Passport without changing your existing cards
npx @sukojin/token-stack generate --card passport --name YOUR_HANDLE --github YOUR_GITHUB_HANDLE

# Publish it to your existing Gist when you want it in a README
npx @sukojin/token-stack sync --card passport --name YOUR_HANDLE --github YOUR_GITHUB_HANDLE --gist YOUR_GIST_ID
```

`--github` is optional. When set, token-stack fetches only that public GitHub avatar once, embeds it into the SVG, and does not put an external image URL in your README.

## README layout guide

Cards have intentional native ratios, so a README can stay balanced instead of becoming a wall of charts.

| Placement | Command | Native size | Best use |
|---|---|---:|---|
| Two-column profile grid | `generate --card summary --compact --chart grass` | 340×200 | Pair with `github-profile-summary-cards` or another compact card |
| Profile hero | `generate --card summary` | 495×250 | One clear all-time headline |
| Full-row activity | `generate --card activity --days 30` | 495×220 | Weekly/monthly momentum |
| Full-row agent mix | `generate --card agents` | 495×150–220 | Claude Code / Codex / Antigravity workflow split |
| Model mix companion | `generate --card models` | 495×220 | Place beside activity or agents in a two-column layout |

The gallery above intentionally shows three placements: a 495px hero, a responsive two-column pair, and a
340px compact card. Copy the HTML `width` values when you want a fixed presentation, or use `--scale` when
the raw SVG's intrinsic size needs adjusting.

For compact summary trends, choose `--chart bars` for immediate comparison, `--chart line` for a smoother
trend, `--chart grass` for a GitHub-style long-term contribution view, or `--chart skyline` for an animated city landscape. Skyline uses absolute daily volume for overall city scale and relative activity for building height, while sustained periods form one to five activity clusters across the selected window. A consistently heavy user therefore gets a denser multi-district downtown while peaks remain easy to compare. Use `7` days for a weekly update or `30` for a monthly profile.

Skyline reads like an activity landscape: no activity becomes a small field, light activity becomes homes, then mid-rise and high-rise buildings; only the busiest relative days become distinctive landmark towers. The same history always produces the same city.

The full-width Activity Skyline labels every headline value in the upper panel as `TOKENS`, `EST. COST`/`CLAUDE EST.`, or `WINDOW`. Its lower two-level legend explains the current city: `BUILDING HEIGHT / DAILY TOKENS`, `CITY DENSITY / 18/30 ACTIVE DAYS`, and `STREAK · SESSIONS / PROJECTS / 7D · 12 / 3`. Building height is the daily token total, city density reflects sustained token activity, and the green route marks the current trailing run of token-active days. Traffic uses the latest seven days of collected sessions; pedestrians use the largest active-project count in that period. If a streak reaches the left edge of the window, the card uses `≥` because it may have begun earlier. The compact Skyline keeps the artwork clean and carries the explanation in its accessible SVG description.

The building signals are intentionally token-only. Street life is explicitly session/project activity, and the `agents` card remains the provider-session view. Token Stack does not infer programming languages, GitHub contributions, pull requests, or provider totals it cannot read.

It is rendered as connected activity districts rather than one building per day. Each sampled token interval controls the height and density of a district spanning rear, middle, and foreground depth planes, while activity-cluster centers pull surrounding buildings into stronger downtown groups. Small street-front buildings can overlap taller towers behind them instead of forming a single flat row. Foreground buildings deterministically choose glass, office, residential, masonry, or civic architecture; each type changes its roof profile, façade divisions, balconies, cornices, or service floors. A low continuous streetwall and distant city keep the horizon intact, while only prominent local peaks become one or two landmark towers. Tiered needle, split-fin, lantern, tapered-twist, and terraced silhouettes provide architectural variety without copying a real building. A sustained activity plateau stays a dense city district instead of becoming repeated towers. Animated cards construct each foreground silhouette from the street upward, revealing façade detail and floor windows in the same bottom-to-top order. Building façades and windows are clipped to their exact silhouettes, so architectural detail cannot spill outside a sloped roof or tapered tower.

By default, Skyline uses the machine's local time: dawn, day, dusk, and night each have a distinct sky, sun or moon, building palette, and window lighting. Cinematic mode keeps a waterfront composition in every phase. A softened reflection of the complete city supplies atmospheric mass, while foreground buildings add their own broken, tapered reflection segments through deterministic ripple displacement and distance fade. Night adds a deep navy sky, moon halo, activity-weighted warm/cool windows, and shoreline lights. A scheduled `sync` regenerates the SVG at the next interval, keeping an embedded card in step with local time without browser-side JavaScript. Use `--sky dawn`, `--sky day`, `--sky dusk`, or `--sky night` to lock a look.

The default `cinematic` Skyline adds material gradients, edge lighting, layered distant districts, horizon haze, atmospheric depth, a textured shoreline, and full mirrored waterfront reflections while keeping the city fully deterministic and local. Daylight uses neutral glass, concrete, and stone colors; rectilinear rooflines and separate rear/middle depth filters keep the foreground legible without making every background building equally sharp. It aims for the density and composition of a real skyline without embedding a stock photo or making any external image request. Use `--skyline-style classic` when you prefer the flatter pre-0.5 look or need the smallest possible SVG.

```bash
npx @sukojin/token-stack generate --card activity --chart skyline --sky night
npx @sukojin/token-stack generate --card activity --chart skyline --skyline-style classic
```

The default remains `natural + waterfront`. Compose a different city without changing its data semantics:

```bash
# Warm masonry beside a park and walking path
npx @sukojin/token-stack generate --card activity --chart skyline --city-palette copper --city-base park

# Desaturated business district with a road/transit foreground
npx @sukojin/token-stack generate --card activity --chart skyline --city-palette graphite --city-base transit

# Keep cars and pedestrians visible but static with --no-anim, or remove them entirely
npx @sukojin/token-stack generate --card activity --chart skyline --city-motion off
```

Palettes are `natural`, `graphite`, `copper`, and `evergreen`; bases are `waterfront`, `park`, and `transit`. `--city-motion auto` derives up to five small vehicles and pedestrians from recent session/project signals. Animation is deterministic, restrained, and disabled by `prefers-reduced-motion`.

All cards are SVGs. `--scale 0.75`, `--scale 1`, and `--scale 1.25` change intrinsic output dimensions
without distorting the ratio, which is useful when a README renderer does not apply a width attribute.

Summary category bars use a logarithmic comparison by default. Cache reads are often orders of magnitude
larger than input/output; log scale keeps every category visible while the labels retain exact values. Pass
`--breakdown raw` when you specifically want proportional raw-token bars.

## Agent distribution

The `agents` card is deliberately **session-based**, so Claude Code, Codex, and Antigravity can share one explainable denominator even when their local token schemas differ.

The `summary`, `activity`, `models`, and Skyline cards now include Claude Code plus Codex `token_count` usage. Codex cumulative snapshots, cache subsets, counter resets, forked rollouts, and copied snapshots are normalized before aggregation. Antigravity remains session-only because its supported local activity records do not expose provider-comparable token totals. Codex cost stays unpriced: when Claude and Codex tokens are mixed, the card says `CLAUDE EST.` instead of implying that `$` covers Codex subscription use.

`--provider auto` (the default) safely detects these local sources:

| Agent | Default source | Basis |
|---|---|---|
| Claude Code | `~/.claude/projects` | Tokens and unique sessions |
| Codex | `$CODEX_HOME/sessions`, `~/.codex/sessions`, sibling `archived_sessions` | Tokens and unique session IDs |
| Antigravity | `~/.gemini/antigravity/brain` | Unique Antigravity brain transcripts |

Use a provider-only view or override a location when needed:

```bash
npx @sukojin/token-stack generate --card agents --provider codex
npx @sukojin/token-stack stats --provider codex --no-history
npx @sukojin/token-stack generate --card agents --antigravity-source /path/to/brain
```

`--agent-source name:directory` remains available for additional Claude-compatible JSONL sources. Provider logs are never uploaded.

## Provider verification

The compatibility suite exercises fixture-backed Claude Code, Codex, and Antigravity shapes without storing transcript text. Codex's local rollout token schema is not a documented public API, so the parser is deliberately defensive and covered for cumulative snapshots, cache subsets, counter resets, copied events, malformed records, model changes, and Windows/POSIX project paths. The wider suite covers provider-only and mixed histories, legacy migration, Unicode paths, concurrent writers, stale locks, transient Windows locks, corrupt-history preservation, and Gist failures.

Skyline has a deterministic matrix of 11 usage profiles—from an empty first run and a 17K-token first week through spikes, plateaus, 90-day heavy use, 365-day compression, and `Number.MAX_SAFE_INTEGER`. Every profile is rendered in four sky phases and both full and compact layouts: 88 SVGs checked for finite geometry, bounded building sizes, resolved clips and IDs, safe escaped text, local-only content, deterministic output, and token-scale semantics.

CI runs the test, packed-install, and CLI smoke suites on:

- Ubuntu with Node.js 18, 20, 22, and 24, including UTC, Asia/Seoul, and Pacific/Honolulu day boundaries
- Windows with Node.js 20 and 24
- macOS with Node.js 20 and 24
- A temporary install path containing spaces and Unicode characters

Run the same layers locally:

```bash
npm test
npm run verify:skyline
npm run verify:pack
npm pack --dry-run
```

These checks verify the known formats and failure modes; they cannot guarantee that a provider will never change its local, non-public log schema. Malformed fields are ignored, and a schema change may omit sessions until a new regression case is added.

## Commands

| Command | What it does |
|---|---|
| `generate` | Write SVG card(s) to disk (default) |
| `sync` | Upload card(s) to a Gist via `gh` and print embed links |
| `stats` | Print a usage summary to the terminal |
| `json` | Print aggregated statistics for another frontend |
| `init` | Print a reviewable Claude Code hook and README embed; changes no settings |

## Options

| Flag | Default | Notes |
|---|---|---|
| `--card` | `summary` | `summary`, `activity`, `models`, `agents`, `passport`, or `all` |
| `--compact` | | 340×200 summary card |
| `--chart` | `bars` | Trend: `bars`, `line`, `grass`, or `skyline` (also works with the activity card) |
| `--sky` | `auto` | Skyline atmosphere: follows local time, or `dawn`, `day`, `dusk`, `night` |
| `--skyline-style` | `cinematic` | Skyline rendering: layered `cinematic` or lighter `classic` |
| `--city-palette` | `natural` | `natural`, `graphite`, `copper`, or `evergreen` |
| `--city-base` | `waterfront` | `waterfront`, `park`, or `transit` foreground |
| `--city-motion` | `auto` | `auto` uses collected session/project signals; `off` removes street life |
| `--breakdown` | `log` | Summary comparison: `log` (readable) or `raw` (proportional tokens) |
| `--theme` | `dark` | `dark`, `light`, `dracula`, or `tokyonight` |
| `--days` | `30` | Activity-chart window, from 1 to 3650 days |
| `--scale` | `1` | Intrinsic SVG scale from `0.25` to `3`, preserving ratio |
| `--no-anim` | | Render static cards |
| `--name` | `LOCAL OPERATOR` | Passport display name |
| `--season` | `Season 01` | Passport season label |
| `--archetype` | `auto` | Passport archetype; `auto` derives it from local activity |
| `--source` | `~/.claude/projects` | Primary Claude Code data directory |
| `--provider` | `auto` | `auto`, `claude`, `codex`, or `antigravity` |
| `--codex-source` | auto-discovered | Override all Codex session discovery with one directory |
| `--antigravity-source` | `~/.gemini/antigravity/brain` | Override Antigravity brain directory |
| `--agent-source` | | Extra `name:directory` JSONL source; repeatable |
| `--privacy` | `public` | `private` removes project names from JSON output |
| `--gist` | | Existing Gist ID to update in place |
| `--public` | | Make a newly-created Gist public; default is secret |

## Keep cards fresh

Run this once to get a safe, copyable setup snippet:

```bash
npx @sukojin/token-stack init --gist YOUR_GIST_ID
```

It prints a Claude Code `SessionEnd` hook that runs `token-stack sync`. Review and add it to your `~/.claude/settings.json`, or schedule the same command with Task Scheduler / cron.

## History and costs

Local tools may archive or delete old transcripts. token-stack stores a small provider-scoped per-day snapshot at `~/.token-stack/history.json` so all-time values continue growing. It contains aggregate token/model/project labels and session IDs, never messages or transcript text. `--privacy private` removes project names from JSON output; it does not rewrite this local history file. Writes are atomic, serialized across simultaneous token-stack processes, and merged so a hook and a scheduled sync cannot silently overwrite each other.

The first run records the machine's IANA timezone in history and keeps using it for day boundaries, streaks, and chart windows. Existing history without this field adopts the machine timezone once on upgrade. This prevents travel, CI, or a server move from counting the same transcript under a second date. Skyline's `--sky auto` atmosphere still follows the machine's current clock; it does not change the saved aggregation timezone.

Costs are API-price estimates, not subscription charges. Codex product usage is intentionally unpriced; mixed cards label the dollar figure as a Claude estimate. Treat every displayed cost as a comparable Claude usage metric rather than an invoice.

## Development and releases

```bash
npm test
npm run verify:skyline
npm run verify:city
npm run verify:pack
npm pack --dry-run
```

Push a `v*` tag to publish a release. The workflow runs tests and publishes `@sukojin/token-stack` with the repository `NPM_TOKEN` secret; it safely skips publishing when the secret is absent.

## Requirements

- Node.js 18+
- [GitHub CLI](https://cli.github.com) with `gh auth login` for `sync`
- Local sessions from at least one supported provider

## License

MIT
