#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  collectEntries, collectCodexSessions, collectAntigravitySessions,
  toDayRecords, loadHistory, mergeHistory, saveHistory,
  aggregate, filterHistoryByProvider, currentTimeZone, defaultSourceDir, defaultHistoryFile, defaultCodexSourceDir, defaultAntigravitySourceDir,
} from "../src/collect.js";
import { CARDS, formatTokens, formatCost } from "../src/render.js";
import { THEMES } from "../src/themes.js";
import { syncToGist } from "../src/sync.js";

const PROVIDERS = ["auto", "claude", "codex", "antigravity"];

const HELP = `token-stack — animated token-usage cards from your local Claude Code sessions

Usage:
  npx @sukojin/token-stack [command] [options]

Commands:
  generate    Write SVG card(s) to disk (default)
  sync        Upload card(s) to a GitHub gist and print embed links
  stats       Print a usage summary to the terminal
  json        Print aggregated stats as JSON

Options:
  --card <name>     summary | activity | models | agents | passport | all   (default: summary)
  --compact         340x200 summary card (matches github-profile-summary-cards)
  --chart <name>    trend style: bars | line | grass | skyline (default: bars)
  --sky <mode>      skyline sky: auto | dawn | day | dusk | night (default: auto/local time)
  --breakdown <mode> summary bars: log | raw                  (default: log)
  --theme <name>    ${Object.keys(THEMES).join(" | ")}   (default: dark)
  --days <n>        window for the activity chart        (default: 30)
  --speed <x>       animation speed multiplier           (default: 1)
  --scale <x>       intrinsic SVG scale, preserves aspect ratio (default: 1)
  --no-anim         render static cards
  --title <text>    custom card title
  --name <text>     display name for the passport card
  --github <handle> embed this public GitHub avatar in the passport card
  --season <text>   passport season label                (default: Season 01)
  --archetype <x>   passport archetype or auto           (default: auto)
  -o, --out <path>  output file or directory             (default: .)
  --source <dir>    Claude data dir                      (default: ~/.claude/projects)
  --provider <name> ${PROVIDERS.join(" | ")}                       (default: auto)
  --codex-source <dir> Codex session directory             (default: ~/.codex/sessions)
  --antigravity-source <dir> Antigravity brain directory   (default: ~/.gemini/antigravity/brain)
  --agent-source <name:dir>  add a JSONL-compatible agent data directory (repeatable)
  --history <file>  snapshot file for all-time stats     (default: ~/.token-stack/history.json)
  --no-history      current transcripts only, no snapshot read/write
  --privacy <mode>  public | private (hide project names in JSON)   (default: public)
  --gist <id>       existing gist to update (sync)
  --public          make the created gist public (sync; default: secret)
  -h, --help        show this help

Setup:
  init [--gist <id>]  Print a safe Claude Code SessionEnd hook and README embed.
`;

function parseArgs(argv) {
  const opts = {
    command: "generate",
    card: "summary",
    theme: "dark",
    days: 30,
    speed: 1,
    scale: 1,
    anim: true,
    out: ".",
    source: defaultSourceDir(),
    historyFile: defaultHistoryFile(),
    history: true,
    provider: "auto",
    privacy: "public",
    breakdown: "log",
    agentSources: [],
    codexSource: defaultCodexSourceDir(),
    antigravitySource: defaultAntigravitySourceDir(),
    season: "Season 01",
    archetype: "auto",
    sky: "auto",
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) opts.command = args.shift();
  while (args.length) {
    const a = args.shift();
    switch (a) {
      case "--card": opts.card = args.shift(); break;
      case "--theme": opts.theme = args.shift(); break;
      case "--days": opts.days = Math.min(3650, Math.max(1, parseInt(args.shift(), 10) || 30)); opts.daysSet = true; break;
      case "--speed": opts.speed = Math.max(0.1, parseFloat(args.shift()) || 1); break;
      case "--scale": opts.scale = Math.max(0.25, Math.min(3, parseFloat(args.shift()) || 1)); break;
      case "--no-anim": opts.anim = false; break;
      case "--compact": opts.compact = true; break;
      case "--chart": opts.chart = args.shift(); break;
      case "--sky": opts.sky = args.shift(); break;
      case "--breakdown": opts.breakdown = args.shift(); break;
      case "--title": opts.title = args.shift(); break;
      case "--name": opts.name = args.shift(); break;
      case "--github": opts.github = args.shift(); break;
      case "--season": opts.season = args.shift(); break;
      case "--archetype": opts.archetype = args.shift(); break;
      case "-o": case "--out": opts.out = args.shift(); break;
      case "--source": opts.source = args.shift(); break;
      case "--provider": opts.provider = args.shift(); break;
      case "--codex-source": opts.codexSource = args.shift(); break;
      case "--antigravity-source": opts.antigravitySource = args.shift(); break;
      case "--agent-source": opts.agentSources.push(args.shift()); break;
      case "--history": opts.historyFile = args.shift(); break;
      case "--no-history": opts.history = false; break;
      case "--privacy": opts.privacy = args.shift(); break;
      case "--gist": opts.gist = args.shift(); break;
      case "--public": opts.public = true; break;
      case "-h": case "--help": console.log(HELP); process.exit(0);
      default:
        console.error(`Unknown option: ${a}\n`);
        console.error(HELP);
        process.exit(1);
    }
  }
  // A 30-day grass grid is only ~5 columns; default to 17 weeks like GitHub.
  if (opts.chart === "grass" && !opts.daysSet) opts.days = 119;
  if (!PROVIDERS.includes(opts.provider)) throw new Error(`Unknown provider "${opts.provider}". Available: ${PROVIDERS.join(", ")}`);
  if (!["public", "private"].includes(opts.privacy)) throw new Error('Privacy must be "public" or "private".');
  if (!["log", "raw"].includes(opts.breakdown)) throw new Error('Breakdown must be "log" or "raw".');
  if (!["auto", "dawn", "day", "dusk", "night"].includes(opts.sky)) throw new Error('Sky must be "auto", "dawn", "day", "dusk", or "night".');
  return opts;
}

function publicStats(stats, privacy) {
  if (privacy !== "private") return stats;
  return { ...stats, byProject: [] };
}

function parseAgentSource(value) {
  const at = value?.indexOf(":");
  if (!value || at < 1 || at === value.length - 1) throw new Error("--agent-source must use name:directory, e.g. codex:C:\\logs");
  return { agent: value.slice(0, at), source: value.slice(at + 1) };
}

function printInit(opts) {
  const gist = opts.gist || "YOUR_GIST_ID";
  console.log("Add this command to the SessionEnd hook in ~/.claude/settings.json:");
  console.log(JSON.stringify({ hooks: { SessionEnd: [{ hooks: [{ type: "command", command: `npx @sukojin/token-stack sync --card all --gist ${gist}` }] }] } }, null, 2));
  console.log("\nThen paste this into your README:");
  console.log(`![token-stack](https://gist.githubusercontent.com/<you>/${gist}/raw/token-stack-summary.svg)`);
  console.log("\nThis command only prints instructions; it never changes your Claude settings.");
}

async function loadGithubAvatar(handle) {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(handle ?? "")) throw new Error("--github must be a valid GitHub handle.");
  const headers = { "User-Agent": "token-stack", Accept: "application/vnd.github+json" };
  const profile = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, { headers });
  if (!profile.ok) throw new Error(`Could not find GitHub user "${handle}" (${profile.status}).`);
  const { avatar_url: avatarUrl } = await profile.json();
  const image = await fetch(`${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}size=160`, { headers: { "User-Agent": "token-stack" } });
  const type = image.headers.get("content-type")?.split(";")[0] ?? "";
  if (!image.ok || !["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error("GitHub avatar could not be read as a PNG, JPEG, or WebP image.");
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.length > 1024 * 1024) throw new Error("GitHub avatar is unexpectedly large (over 1 MB).");
  return `data:${type};base64,${bytes.toString("base64")}`;
}

async function renderCards(stats, opts) {
  // `all` remains the compact analytics set users already automate. Passport
  // is an intentional, share-oriented opt-in card.
  if (opts.github && (opts.card === "passport")) opts.avatarDataUri = await loadGithubAvatar(opts.github);
  const names = opts.card === "all" ? Object.keys(CARDS).filter((name) => name !== "passport") : [opts.card];
  return names.map((name) => {
    const render = CARDS[name];
    if (!render) {
      console.error(`Unknown card "${name}". Available: ${Object.keys(CARDS).join(", ")}, all`);
      process.exit(1);
    }
    const suffix = opts.compact && name === "summary" ? "-compact" : "";
    return {
      name: `token-stack-${name}${suffix}.svg`,
      content: render(stats, opts),
    };
  });
}

let opts;
try { opts = parseArgs(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exit(1); }
if (opts.command === "init") { printInit(opts); process.exit(0); }
let entries = [];
if (opts.provider === "auto" || opts.provider === "claude") entries = entries.concat(collectEntries(opts.source, { agent: "claude-code" }));
if (opts.provider === "auto" || opts.provider === "codex") entries = entries.concat(collectCodexSessions(opts.codexSource));
if (opts.provider === "auto" || opts.provider === "antigravity") entries = entries.concat(collectAntigravitySessions(opts.antigravitySource));
try {
  for (const value of opts.agentSources) {
    const { agent, source } = parseAgentSource(value);
    entries = entries.concat(collectEntries(source, { agent }));
  }
} catch (err) { console.error(err.message); process.exit(1); }
let history;
try {
  history = opts.history ? loadHistory(opts.historyFile) : { version: 1, days: {} };
  history.timezone ??= currentTimeZone();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
mergeHistory(history, toDayRecords(entries, { timeZone: history.timezone }));
let viewHistory = filterHistoryByProvider(history, opts.provider);
if (Object.keys(viewHistory.days).length === 0) {
  const source = opts.provider === "codex" ? opts.codexSource : opts.provider === "antigravity" ? opts.antigravitySource : opts.source;
  const label = opts.provider === "auto" ? "supported AI coding" : opts.provider === "claude" ? "Claude Code" : opts.provider === "codex" ? "Codex" : "Antigravity";
  console.error(`No ${label} activity found in ${source}`);
  console.error("Use the matching --source option if your local session directory is elsewhere.");
  process.exit(1);
}
if (opts.history) {
  try {
    history = saveHistory(history, opts.historyFile);
    viewHistory = filterHistoryByProvider(history, opts.provider);
  }
  catch (err) { console.error(err.message); process.exit(1); }
}
const stats = publicStats(aggregate(viewHistory, { days: opts.days }), opts.privacy);

switch (opts.command) {
  case "generate": {
    const cards = await renderCards(stats, opts);
    for (const card of cards) {
      const file =
        opts.out.endsWith(".svg") && cards.length === 1
          ? opts.out
          : path.join(opts.out.endsWith(".svg") ? path.dirname(opts.out) : opts.out, card.name);
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, card.content);
      console.log(`wrote ${file}`);
    }
    break;
  }
  case "sync": {
    const cards = await renderCards(stats, opts);
    const res = syncToGist(cards, { gistId: opts.gist, isPublic: opts.public });
    console.log(`gist: https://gist.github.com/${res.gistId}`);
    console.log("\nEmbed in any README:\n");
    for (const { raw } of res.urls) {
      console.log(`![token-stack](${raw})`);
    }
    if (!opts.gist) {
      console.log(`\nNext time, update in place with:\n  npx @sukojin/token-stack sync --gist ${res.gistId}`);
    }
    break;
  }
  case "stats": {
    const t = stats.totals;
    console.log(`Tokens (all time)   ${formatTokens(t.total)}  (~${formatCost(t.cost)})`);
    console.log(`  input             ${formatTokens(t.input)}`);
    console.log(`  output            ${formatTokens(t.output)}`);
    console.log(`  cache read        ${formatTokens(t.cacheRead)}`);
    console.log(`  cache write       ${formatTokens(t.cacheWrite)}`);
    console.log(`API responses       ${t.count}`);
    console.log(`Sessions            ${stats.sessions}`);
    console.log(`Active days         ${stats.activeDays}  (streak ${stats.streak})`);
    console.log(`\nBy model:`);
    for (const m of stats.byModel) {
      console.log(`  ${m.name.padEnd(28)} ${formatTokens(m.total).padStart(8)}  ${formatCost(m.cost)}`);
    }
    console.log(`\nBy agent:`);
    for (const a of stats.byAgentActivity) {
      const share = stats.agentSessions ? ((a.sessions / stats.agentSessions) * 100).toFixed(1) : "0.0";
      console.log(`  ${a.name.padEnd(28)} ${String(a.sessions).padStart(8)} sessions  ${share}%`);
    }
    console.log(`\nTop projects:`);
    for (const p of stats.byProject.slice(0, 8)) {
      console.log(`  ${p.name.padEnd(28)} ${formatTokens(p.total).padStart(8)}`);
    }
    break;
  }
  case "json":
    console.log(JSON.stringify(stats, null, 2));
    break;
  default:
    console.error(`Unknown command: ${opts.command}\n`);
    console.error(HELP);
    process.exit(1);
}
