# token-stack

Generate SVG cards from local Claude Code and Codex activity.

[![npm](https://img.shields.io/npm/v/@sukojin/token-stack?style=flat-square)](https://www.npmjs.com/package/@sukojin/token-stack)
[![test](https://github.com/sukoji/token-stack/actions/workflows/test.yml/badge.svg)](https://github.com/sukoji/token-stack/actions/workflows/test.yml)
[![node](https://img.shields.io/badge/node-%E2%89%A518-3fb950?style=flat-square)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

Token Stack reads usage logs on your machine and writes standalone SVG files for GitHub READMEs. It has no hosted backend and does not upload transcripts. Publishing through a Gist is optional.

<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-activity.svg" width="760" alt="30-day token activity skyline"/>
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-summary-compact.svg" width="340" alt="Token activity grass chart"/>
  <img src="https://raw.githubusercontent.com/sukoji/token-stack/main/assets/token-stack-agents.svg" width="420" alt="Agent session distribution"/>
</p>

## Quick start

Node.js 18 or later is required. `npx` downloads and runs the current package release.

```bash
# Inspect the skyline presets with your own data
npx @sukojin/token-stack preview

# Write the standard cards to the current directory
npx @sukojin/token-stack generate --card all

# Create a Gist and print Markdown embed links
npx @sukojin/token-stack sync --card all
```

Update the same Gist later with:

```bash
npx @sukojin/token-stack sync --card all --gist YOUR_GIST_ID
```

`sync` requires [GitHub CLI](https://cli.github.com) with `gh auth login`. Local generation does not.

## Data sources

| Provider | Default location | Included data |
|---|---|---|
| Claude Code | `~/.claude/projects` | Tokens and sessions |
| Codex | `$CODEX_HOME/sessions`, `~/.codex/sessions`, and sibling archives | Tokens and sessions |
| Antigravity | `~/.gemini/antigravity/brain` | Sessions only |

Use `--provider claude`, `--provider codex`, or `--provider antigravity` for a provider-only view. Override source paths with `--source`, `--codex-source`, and `--antigravity-source`.

Codex cost is not estimated. When Claude and Codex tokens appear together, the dollar label is `CLAUDE EST.`.

## Cards

| Card | Contents |
|---|---|
| `summary` | All-time tokens, Claude cost estimate, token categories, streak |
| `activity` | Daily activity for the selected window |
| `models` | Token share by model |
| `agents` | Session share across supported agents |
| `passport` | Optional activity-profile card |

`--card all` writes `summary`, `activity`, `models`, and `agents`. Passport stays opt-in:

```bash
npx @sukojin/token-stack generate --card passport --name YOUR_HANDLE --github YOUR_GITHUB_HANDLE
```

`--github` fetches the public avatar once and embeds it in the SVG.

## Skyline

```bash
npx @sukojin/token-stack generate --card activity --chart skyline --days 30
```

The chart maps activity to the scene:

- building height: daily tokens
- city density: active days and sustained activity
- green route: current token-active streak
- traffic: recent sessions
- pedestrians: active projects

The same history and options produce the same city. Weather and season only change its appearance; they are not usage metrics.

### Presets

| Preset | Look |
|---|---|
| `default` | Natural waterfront, clear sky, local-time lighting |
| `rainy-noir` | Graphite transit district, rain, night |
| `autumn-park` | Copper park, mist, autumn dusk |
| `winter-transit` | Graphite transit district, snow, winter dawn |
| `evergreen-mist` | Evergreen waterfront, spring mist |

```bash
npx @sukojin/token-stack generate --card activity --chart skyline --preset rainy-noir
```

Preset values can be overridden:

```bash
npx @sukojin/token-stack generate --card activity --chart skyline \
  --preset rainy-noir --weather clear --sky dusk
```

Available controls:

- `--city-palette natural|graphite|copper|evergreen`
- `--city-base waterfront|park|transit`
- `--weather auto|clear|cloudy|mist|rain|snow`
- `--city-season auto|spring|summer|autumn|winter|off`
- `--sky auto|dawn|day|dusk|night`
- `--city-motion auto|off`
- `--skyline-style cinematic|classic`

`--weather auto` and `--city-season auto` use the local calendar. They do not call a weather service or use location data. `--season` is a separate text label for the Passport card.

## Other charts

The summary card supports `bars`, `line`, `grass`, and `skyline` charts. Generate the compact GitHub-style grass card with:

```bash
npx @sukojin/token-stack generate --card summary --compact --chart grass
```

Summary category bars use a log scale so small input/output values remain visible beside large cache totals. Use `--breakdown raw` for raw proportions.

## Animation

SVG animation follows `prefers-reduced-motion` by default.

- `--no-anim`: static SVG
- `--motion-policy always`: ignore the viewer's reduced-motion setting
- `--speed 0.5`: change animation speed

Some README renderers cache remote SVGs. A Gist update keeps the URL stable, but the visible image may take a few minutes to refresh.

## Privacy and history

Token Stack reads local logs but does not upload them. A Gist sync uploads only the rendered SVG.

Daily aggregates are stored at `~/.token-stack/history.json` because providers may archive old sessions. The file contains counts, token totals, model/project labels, and session IDs—not message text. Use `--no-history` to skip it or `--privacy private` to remove project names from JSON output.

Provider log formats can change. Codex's local rollout schema is not a documented public API, so compatibility is covered by fixtures and real-log tests rather than an API guarantee.

## CLI

```text
token-stack generate [options]   Write SVG cards
token-stack sync [options]       Upload cards to a Gist
token-stack preview [options]    Build a local preset gallery
token-stack stats [options]      Print a terminal summary
token-stack json [options]       Print aggregated JSON
token-stack init [options]       Print hook and embed setup
```

Run `npx @sukojin/token-stack --help` for every option.

| Flag | Default | Purpose |
|---|---|---|
| `--card` | `summary` | Card name or `all` |
| `--days` | `30` | Activity window |
| `--theme` | `dark` | `dark`, `light`, `dracula`, or `tokyonight` |
| `--chart` | `bars` | `bars`, `line`, `grass`, or `skyline` |
| `--scale` | `1` | Intrinsic SVG scale from `0.25` to `3` |
| `-o, --out` | `.` | Output file or directory |
| `--gist` | — | Existing Gist ID to update |

## Development

```bash
npm test
npm run verify:skyline
npm run verify:city
npm run verify:pack
npm pack --dry-run
```

CI covers Node.js 18–24 on Ubuntu, Windows, and macOS.

## License

MIT
