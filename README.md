# token-stack

**Private, shareable AI coding activity cards for your GitHub README — no server required.**

[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-3fb950?style=flat-square)](https://nodejs.org)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-8b949e?style=flat-square)](./package.json)
[![npm](https://img.shields.io/npm/v/@sukojin/token-stack?style=flat-square)](https://www.npmjs.com/package/@sukojin/token-stack)

`token-stack` reads the local JSONL transcripts created by Claude Code, aggregates token usage, and renders animated SVG cards for a GitHub profile, project README, or blog. Your transcripts stay on your machine; only the SVG you choose to publish leaves it.

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
| `summary` | All-time tokens, estimated API cost, streak, and an order-of-magnitude input/output/cache comparison |
| `activity` | Daily token activity for a selected window |
| `models` | Token share by model |
| `agents` | Session-based activity share across Claude Code, Codex, and Antigravity |
| `passport` | Optional share card that turns session activity into an AI-workflow archetype |

Use `--card all` to render every card. SVGs respect `prefers-reduced-motion`; pass `--no-anim` for fully static output.

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
trend, `--chart grass` for a GitHub-style long-term contribution view, or `--chart skyline` for an animated city landscape. Skyline uses absolute daily volume for overall city scale and relative activity for building height, so a consistently heavy user gets a denser downtown while peaks remain easy to compare. Use `7` days for a weekly update or `30` for a monthly profile.

Skyline reads like an activity landscape: no activity becomes a small field, light activity becomes homes, then mid-rise and high-rise buildings; only the busiest relative days become distinctive landmark towers. The same history always produces the same city.

It is rendered as connected activity districts rather than one building per day: a low continuous streetwall and distant city keep the horizon intact, while only prominent local peaks become one or two landmark towers. Tiered needle, split-fin, lantern, tapered-twist, and terraced silhouettes provide architectural variety without copying a real building. A deterministic data-derived rotation draws from all five forms, so different histories produce different landmarks while the same history always reproduces the same city. A sustained activity plateau stays a dense city district instead of becoming repeated towers. Building façades and windows are clipped to their exact silhouettes, so architectural detail cannot spill outside a sloped roof or tapered tower.

By default, Skyline uses the machine's local time: dawn, day, dusk, and night each have a distinct sky, sun or moon, building palette, and window lighting. Night mode adds a deep navy sky, moon halo, activity-weighted warm/cool windows, shoreline lights, water, and restrained reflections. A scheduled `sync` regenerates the SVG at the next interval, keeping an embedded card in step with local time without browser-side JavaScript. Use `--sky dawn`, `--sky day`, `--sky dusk`, or `--sky night` to lock a look.

All cards are SVGs. `--scale 0.75`, `--scale 1`, and `--scale 1.25` change intrinsic output dimensions
without distorting the ratio, which is useful when a README renderer does not apply a width attribute.

Summary category bars use a logarithmic comparison by default. Cache reads are often orders of magnitude
larger than input/output; log scale keeps every category visible while the labels retain exact values. Pass
`--breakdown raw` when you specifically want proportional raw-token bars.

## Agent distribution

The `agents` card is deliberately **session-based**, not token-based. Claude exposes billed token fields while Codex and Antigravity logs do not expose comparable totals. Counting unique local sessions gives every supported agent a fair, explainable activity share without inventing token data.

`--provider auto` (the default) safely detects these local sources:

| Agent | Default source | Basis |
|---|---|---|
| Claude Code | `~/.claude/projects` | Unique Claude sessions |
| Codex | `~/.codex/sessions` | Unique Codex rollout files |
| Antigravity | `~/.gemini/antigravity/brain` | Unique Antigravity brain transcripts |

Use a provider-only view or override a location when needed:

```bash
npx @sukojin/token-stack generate --card agents --provider codex
npx @sukojin/token-stack generate --card agents --antigravity-source /path/to/brain
```

`--agent-source name:directory` remains available for additional Claude-compatible JSONL sources. Provider logs are never uploaded.

## Provider verification

Every supported provider adapter has fixture-backed tests for its session metadata and timestamp shape, plus tests for malformed input, duplicate session handling, and legacy history migration. The parser only records fields needed for local aggregation; it never stores transcript text. When a provider changes a private format, the adapter should fail closed (omit unrecognized sessions) until a new fixture and regression test are added.

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
| `--breakdown` | `log` | Summary comparison: `log` (readable) or `raw` (proportional tokens) |
| `--theme` | `dark` | `dark`, `light`, `dracula`, or `tokyonight` |
| `--days` | `30` | Activity-chart window |
| `--scale` | `1` | Intrinsic SVG scale from `0.25` to `3`, preserving ratio |
| `--no-anim` | | Render static cards |
| `--name` | `LOCAL OPERATOR` | Passport display name |
| `--season` | `Season 01` | Passport season label |
| `--archetype` | `auto` | Passport archetype; `auto` derives it from local activity |
| `--source` | `~/.claude/projects` | Primary Claude Code data directory |
| `--provider` | `auto` | `auto`, `claude`, `codex`, or `antigravity` |
| `--codex-source` | `~/.codex/sessions` | Override Codex session directory |
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

Claude Code may delete old transcripts. token-stack stores a small per-day snapshot at `~/.token-stack/history.json` so all-time values continue growing. It contains aggregate token counts, not messages. Writes are atomic.

Costs are API-price estimates, not subscription charges. If you use Pro or Max, treat them as a comparable usage metric rather than an invoice.

## Development and releases

```bash
npm test
npm pack --dry-run
```

Push a `v*` tag to publish a release. The workflow runs tests and publishes `@sukojin/token-stack` with the repository `NPM_TOKEN` secret; it safely skips publishing when the secret is absent.

## Requirements

- Node.js 18+
- [GitHub CLI](https://cli.github.com) with `gh auth login` for `sync`
- Claude Code local sessions for the built-in source

## License

MIT
