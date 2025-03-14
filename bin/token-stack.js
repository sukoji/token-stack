#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  collectEntries, toDayRecords, loadHistory, mergeHistory, saveHistory,
  aggregate, defaultSourceDir, defaultHistoryFile,
} from "../src/collect.js";
import { CARDS, formatTokens, formatCost } from "../src/render.js";
import { THEMES } from "../src/themes.js";
import { syncToGist } from "../src/sync.js";

const HELP = `token-stack — animated token-usage cards from your local Claude Code sessions

Usage:
  npx token-stack [command] [options]

Commands:
  generate    Write SVG card(s) to disk (default)
  sync        Upload card(s) to a GitHub gist and print embed links
  stats       Print a usage summary to the terminal
  json        Print aggregated stats as JSON

Options:
  --card <name>     summary | activity | models | all   (default: summary)
  --theme <name>    ${Object.keys(THEMES).join(" | ")}   (default: dark)
  --days <n>        window for the activity chart        (default: 30)
  --speed <x>       animation speed multiplier           (default: 1)
  --no-anim         render static cards
  --title <text>    custom card title
  -o, --out <path>  output file or directory             (default: .)
  --source <dir>    Claude data dir                      (default: ~/.claude/projects)
  --history <file>  snapshot file for all-time stats     (default: ~/.token-stack/history.json)
  --no-history      current transcripts only, no snapshot read/write
  --gist <id>       existing gist to update (sync)
  --public          make the created gist public (sync; default: secret)
  -h, --help        show this help
`;

function parseArgs(argv) {
  const opts = {
    command: "generate",
    card: "summary",
    theme: "dark",
    days: 30,
    speed: 1,
    anim: true,
    out: ".",
    source: defaultSourceDir(),
    historyFile: defaultHistoryFile(),
    history: true,
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) opts.command = args.shift();
  while (args.length) {
    const a = args.shift();
    switch (a) {
      case "--card": opts.card = args.shift(); break;
      case "--theme": opts.theme = args.shift(); break;
      case "--days": opts.days = Math.max(1, parseInt(args.shift(), 10) || 30); break;
      case "--speed": opts.speed = Math.max(0.1, parseFloat(args.shift()) || 1); break;
      case "--no-anim": opts.anim = false; break;
      case "--title": opts.title = args.shift(); break;
      case "-o": case "--out": opts.out = args.shift(); break;
      case "--source": opts.source = args.shift(); break;
      case "--history": opts.historyFile = args.shift(); break;
      case "--no-history": opts.history = false; break;
      case "--gist": opts.gist = args.shift(); break;
      case "--public": opts.public = true; break;
      case "-h": case "--help": console.log(HELP); process.exit(0);
      default:
        console.error(`Unknown option: ${a}\n`);
        console.error(HELP);
        process.exit(1);
    }
  }
  return opts;
}

function renderCards(stats, opts) {
  const names = opts.card === "all" ? Object.keys(CARDS) : [opts.card];
  return names.map((name) => {
    const render = CARDS[name];
    if (!render) {
      console.error(`Unknown card "${name}". Available: ${Object.keys(CARDS).join(", ")}, all`);
      process.exit(1);
    }
    return {
      name: `token-stack-${name}.svg`,
      content: render(stats, opts),
    };
  });
}

const opts = parseArgs(process.argv.slice(2));
const entries = collectEntries(opts.source);
const history = opts.history ? loadHistory(opts.historyFile) : { version: 1, days: {} };
mergeHistory(history, toDayRecords(entries));
if (Object.keys(history.days).length === 0) {
  console.error(`No usage data found in ${opts.source}`);
  console.error("Is Claude Code installed and has it been used on this machine?");
  process.exit(1);
}
if (opts.history) saveHistory(history, opts.historyFile);
const stats = aggregate(history, { days: opts.days });

switch (opts.command) {
  case "generate": {
    const cards = renderCards(stats, opts);
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
    const cards = renderCards(stats, opts);
    const res = syncToGist(cards, { gistId: opts.gist, isPublic: opts.public });
    console.log(`gist: https://gist.github.com/${res.gistId}`);
    console.log("\nEmbed in any README:\n");
    for (const { raw } of res.urls) {
      console.log(`![token-stack](${raw})`);
    }
    if (!opts.gist) {
      console.log(`\nNext time, update in place with:\n  npx github:sukoji/token-stack sync --gist ${res.gistId}`);
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
