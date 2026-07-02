# ⚡ token-stack

**Animated token-usage cards for your GitHub README — no server required.**

`token-stack` reads the session transcripts Claude Code already keeps on your
machine (`~/.claude/projects/**/*.jsonl`), aggregates your token usage, and
renders it as animated SVG cards you can embed anywhere — your profile README,
a project README, a blog. Everything runs locally; nothing is uploaded except
the SVG you choose to publish.

<p align="center">
  <img src="./assets/token-stack-summary.svg" alt="summary card"/>
</p>
<p align="center">
  <img src="./assets/token-stack-activity.svg" alt="activity card"/>
  <img src="./assets/token-stack-models.svg" alt="models card"/>
</p>

## Quick start

```bash
# render cards into the current directory
npx github:sukoji/token-stack generate --card all

# or publish straight to a GitHub gist and get embed links
npx github:sukoji/token-stack sync --card all
```

`sync` prints ready-to-paste markdown like:

```md
![token-stack](https://gist.githubusercontent.com/<you>/<gist-id>/raw/token-stack-summary.svg)
```

Paste that into any README. Re-running `sync --gist <id>` refreshes the same
URL, so the embed updates everywhere at once.

## Why no server?

Cards like `github-readme-stats` need a serverless function because the data
lives behind an API. Your token usage lives **on your machine**, so the
pipeline is simply:

```
local JSONL transcripts ──► token-stack (CLI) ──► animated SVG ──► gist / repo
```

GitHub proxies README images through camo, and SVGs with inline CSS/SMIL
animations play just fine — no JavaScript, no backend, $0 forever.

## Commands

| command | what it does |
|---|---|
| `generate` | write SVG card(s) to disk (default) |
| `sync` | upload card(s) to a gist via `gh` and print embed links |
| `stats` | terminal summary |
| `json` | aggregated stats as JSON (build your own frontend) |

## Options

| flag | default | notes |
|---|---|---|
| `--card` | `summary` | `summary` \| `activity` \| `models` \| `all` |
| `--theme` | `dark` | `dark` \| `light` \| `dracula` \| `tokyonight` |
| `--days` | `30` | window for the activity chart |
| `--speed` | `1` | animation speed multiplier (`2` = twice as fast) |
| `--no-anim` | | render static cards |
| `--title` | | custom card title |
| `-o, --out` | `.` | output file or directory |
| `--source` | `~/.claude/projects` | Claude Code data dir |
| `--gist` | | existing gist id to update in place |

Animations respect `prefers-reduced-motion`.

## Keeping cards fresh

Add a [Claude Code hook](https://docs.anthropic.com/en/docs/claude-code/hooks)
so every session refreshes your gist automatically — `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          { "type": "command", "command": "npx github:sukoji/token-stack sync --card all --gist YOUR_GIST_ID" }
        ]
      }
    ]
  }
}
```

Or run it on a schedule with Task Scheduler / cron.

## Cost estimates

Costs are estimated from public per-MTok API pricing (cache writes at 1.25×
input, cache reads at 0.1×). If you're on a subscription plan the dollar figure
is what your usage *would* cost via the API, not what you paid.

## Requirements

- Node.js ≥ 18
- [GitHub CLI](https://cli.github.com) (`gh auth login`) — only for `sync`
- Claude Code with local sessions (Codex/Gemini adapters welcome — PRs open!)

## License

MIT
