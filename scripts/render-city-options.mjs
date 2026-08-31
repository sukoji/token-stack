import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderActivity } from "../src/render.js";

const values = [.4, .7, 1.1, 2.4, 1.5, .9, 3.2, 1.8, 4.8, 2.1, 1.2, 3.7, 2.5, 1.4];
const byDay = values.map((value, index) => ({
  date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  total: value * 1_000_000,
  cost: 0,
  sessions: 1 + (index % 4),
  projects: 1 + (index % 3),
  agents: 1 + (index % 2),
}));
const stats = {
  totals: {
    total: byDay.reduce((sum, day) => sum + day.total, 0),
    cost: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  byDay,
  streak: byDay.length,
};
const variants = [
  { name: "natural-waterfront", cityPalette: "natural", cityBase: "waterfront" },
  { name: "copper-park", cityPalette: "copper", cityBase: "park" },
  { name: "graphite-transit", cityPalette: "graphite", cityBase: "transit" },
  { name: "evergreen-waterfront", cityPalette: "evergreen", cityBase: "waterfront" },
];

const outIndex = process.argv.indexOf("--out");
const output = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : path.join(os.tmpdir(), "token-stack-city-options"));
fs.mkdirSync(output, { recursive: true });
for (const variant of variants) {
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "day", ...variant });
  fs.writeFileSync(path.join(output, `${variant.name}.svg`), svg);
}
const cards = variants.map((variant) => `<figure><img src="${variant.name}.svg" width="495" height="220" alt="${variant.name}"><figcaption>${variant.name}</figcaption></figure>`).join("");
fs.writeFileSync(path.join(output, "gallery.html"), `<!doctype html><meta charset="utf-8"><title>Token Stack city options</title><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#080b12;color:#d8e0eb;font:13px system-ui}.grid{display:grid;grid-template-columns:repeat(2,495px);gap:16px}figure{margin:0}img{display:block}figcaption{padding:5px 3px}</style><main class="grid">${cards}</main>`);
console.log(output);
