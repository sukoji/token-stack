import { THEMES } from "./themes.js";

export function formatTokens(n) {
  if (n >= 1e9) return trim((n / 1e9).toFixed(2)) + "B";
  if (n >= 1e6) return trim((n / 1e6).toFixed(1)) + "M";
  if (n >= 1e3) return trim((n / 1e3).toFixed(1)) + "k";
  return String(n);
}
const trim = (s) => s.replace(/\.0+$/, "");

export function formatCost(n) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shortModel(id) {
  return id
    .replace(/^claude-/, "")
    .replace(/-\d{8}$/, "")
    .replace(/-(\d)-(\d)/, "-$1.$2");
}

// Shared <style>: entrance fades, bar growth, donut sweep. `speed` divides
// every duration; `anim: false` renders the final frame statically.
function styles({ anim, speed }, extra = "") {
  if (!anim) return "";
  const s = (base) => (base / speed).toFixed(2) + "s";
  return `<style>
.f{opacity:0;animation:fu ${s(0.7)} cubic-bezier(.4,0,.2,1) forwards}
@keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.bx{transform:scaleX(0);transform-box:fill-box;transform-origin:left center;animation:gx ${s(0.9)} cubic-bezier(.2,.6,.2,1) forwards}
@keyframes gx{to{transform:scaleX(1)}}
.by{transform:scaleY(0);transform-box:fill-box;transform-origin:center bottom;animation:gy ${s(0.8)} cubic-bezier(.2,.6,.2,1) forwards}
@keyframes gy{to{transform:scaleY(1)}}
${extra}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01s!important;animation-delay:0s!important}}
</style>`;
}

const delay = (i, step, speed) => `animation-delay:${((i * step) / speed).toFixed(2)}s`;

function frame(w, h, t, title, body, style) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${style}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>`;
}

function resolveTheme(name) {
  return THEMES[name] ?? THEMES.dark;
}

export function renderSummary(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Token Stack · Claude Code" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495, H = 250;
  const { totals } = stats;

  const rows = [
    ["Input", totals.input],
    ["Output", totals.output],
    ["Cache read", totals.cacheRead],
    ["Cache write", totals.cacheWrite],
  ];
  const maxRow = Math.max(...rows.map((r) => r[1]), 1);
  const rowsSvg = rows
    .map(([label, val], i) => {
      const y = 128 + i * 25;
      const w = Math.max(2, Math.round((val / maxRow) * 108));
      return `<g class="f" style="${delay(i + 3, 0.12, speed)}">
<text x="25" y="${y + 5}" font-size="11" fill="${t.subtext}">${label}</text>
<rect x="92" y="${y - 3}" width="108" height="6" rx="3" fill="${t.track}"/>
<rect class="bx" style="${delay(i + 3, 0.12, speed)}" x="92" y="${y - 3}" width="${w}" height="6" rx="3" fill="${t.bars[i]}"/>
<text x="255" y="${y + 5}" font-size="11" font-weight="600" fill="${t.text}" text-anchor="end">${formatTokens(val)}</text>
</g>`;
    })
    .join("\n");

  // 14-day sparkline
  const days = stats.byDay.slice(-14);
  const maxDay = Math.max(...days.map((d) => d.total), 1);
  const chartX = 285, chartW = 185, baseY = 205, chartH = 82;
  const bw = chartW / days.length - 3;
  const spark = days
    .map((d, i) => {
      const h = Math.max(2, Math.round((d.total / maxDay) * chartH));
      const x = chartX + i * (chartW / days.length);
      return `<rect class="by" style="${delay(i + 4, 0.05, speed)}" x="${x.toFixed(1)}" y="${baseY - h}" width="${bw.toFixed(1)}" height="${h}" rx="2" fill="${i === days.length - 1 ? t.big[1] : t.bars[0]}"/>`;
    })
    .join("\n");
  const sparkTotal = days.reduce((a, d) => a + d.total, 0);

  const topModel = stats.byModel[0] ? shortModel(stats.byModel[0].name) : "—";
  const footer = `🔥 ${stats.streak} day streak · ${stats.activeDays} active days · ${topModel}`;

  const body = `
<defs><linearGradient id="big" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="${t.big[0]}"/><stop offset="100%" stop-color="${t.big[1]}"/>
</linearGradient></defs>
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="25" y="33" font-size="16" font-weight="600" fill="${t.title}">⚡ ${esc(title)}</text>
<text class="f" style="${delay(1, 0.12, speed)}" x="25" y="76" font-size="34" font-weight="800" fill="url(#big)">${formatTokens(totals.total)}</text>
<text class="f" style="${delay(2, 0.12, speed)}" x="25" y="97" font-size="12" fill="${t.subtext}">tokens all time · est. ${formatCost(totals.cost)}</text>
${rowsSvg}
<text class="f" style="${delay(3, 0.12, speed)}" x="${chartX}" y="112" font-size="11" fill="${t.subtext}">last 14 days · ${formatTokens(sparkTotal)}</text>
${spark}
<line x1="${chartX}" y1="${baseY + 1}" x2="${chartX + chartW}" y2="${baseY + 1}" stroke="${t.border}"/>
<text class="f" style="${delay(8, 0.12, speed)}" x="25" y="${H - 18}" font-size="11" fill="${t.subtext}">${footer}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }));
}

export function renderActivity(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Token Activity" } = opts;
  const t = resolveTheme(opts.theme);
  const days = stats.byDay;
  const W = 495, H = 220;
  const chartX = 25, chartW = W - 50, baseY = 178, chartH = 108;
  const maxDay = Math.max(...days.map((d) => d.total), 1);
  const bw = chartW / days.length - 2.5;
  const windowTotal = days.reduce((a, d) => a + d.total, 0);
  const windowCost = days.reduce((a, d) => a + d.cost, 0);

  const bars = days
    .map((d, i) => {
      const h = Math.max(2, Math.round((d.total / maxDay) * chartH));
      const x = chartX + i * (chartW / days.length);
      return `<g>
<rect class="by" style="${delay(i, 0.03, speed)}" x="${x.toFixed(1)}" y="${baseY - h}" width="${bw.toFixed(1)}" height="${h}" rx="2" fill="${i === days.length - 1 ? t.big[1] : t.bars[0]}"><title>${d.date}: ${formatTokens(d.total)}</title></rect>
</g>`;
    })
    .join("\n");

  const body = `
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="25" y="33" font-size="16" font-weight="600" fill="${t.title}">📊 ${esc(title)}</text>
<text class="f" style="${delay(1, 0.12, speed)}" x="${W - 25}" y="33" font-size="12" text-anchor="end" fill="${t.subtext}">${formatTokens(windowTotal)} · ${formatCost(windowCost)} · ${days.length}d</text>
${bars}
<line x1="${chartX}" y1="${baseY + 1}" x2="${chartX + chartW}" y2="${baseY + 1}" stroke="${t.border}"/>
<text x="${chartX}" y="${baseY + 18}" font-size="10" fill="${t.subtext}">${days[0]?.date ?? ""}</text>
<text x="${chartX + chartW}" y="${baseY + 18}" font-size="10" text-anchor="end" fill="${t.subtext}">${days[days.length - 1]?.date ?? ""}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }));
}

export function renderModels(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Models" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495, H = 220;
  const cx = 110, cy = 128, r = 56, sw = 20;
  const C = 2 * Math.PI * r;
  const models = stats.byModel.slice(0, 5);
  const total = Math.max(stats.totals.total, 1);
  const othersTotal = stats.byModel.slice(5).reduce((a, m) => a + m.total, 0);
  const segs = [...models.map((m) => ({ name: shortModel(m.name), total: m.total, cost: m.cost }))];
  if (othersTotal > 0) segs.push({ name: "others", total: othersTotal, cost: 0 });

  let cum = 0;
  let donutKeyframes = "";
  const arcs = segs
    .map((m, i) => {
      const frac = m.total / total;
      const len = Math.max(frac * C - 2, 0.5);
      const offset = -cum * C;
      cum += frac;
      const color = t.bars[i % t.bars.length];
      if (anim) donutKeyframes += `@keyframes dn${i}{to{stroke-dasharray:${len.toFixed(1)} ${C.toFixed(1)}}}\n.dn${i}{stroke-dasharray:0 ${C.toFixed(1)};animation:dn${i} ${(1 / speed).toFixed(2)}s cubic-bezier(.2,.6,.2,1) forwards ${((0.1 + i * 0.15) / speed).toFixed(2)}s}\n`;
      const dash = anim ? `class="dn${i}"` : `stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}"`;
      return `<circle ${dash} cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    })
    .join("\n");

  const legend = segs
    .map((m, i) => {
      const y = 62 + i * 26;
      const pct = ((m.total / total) * 100).toFixed(1);
      return `<g class="f" style="${delay(i + 2, 0.12, speed)}">
<rect x="215" y="${y - 9}" width="10" height="10" rx="3" fill="${t.bars[i % t.bars.length]}"/>
<text x="233" y="${y}" font-size="12" fill="${t.text}">${esc(m.name)}</text>
<text x="${W - 25}" y="${y}" font-size="12" text-anchor="end" fill="${t.subtext}">${formatTokens(m.total)} · ${pct}%</text>
</g>`;
    })
    .join("\n");

  const body = `
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="25" y="33" font-size="16" font-weight="600" fill="${t.title}">🤖 ${esc(title)}</text>
${arcs}
<text class="f" style="${delay(2, 0.12, speed)}" x="${cx}" y="${cy + 1}" font-size="17" font-weight="700" text-anchor="middle" fill="${t.text}">${formatTokens(stats.totals.total)}</text>
<text class="f" style="${delay(3, 0.12, speed)}" x="${cx}" y="${cy + 18}" font-size="10" text-anchor="middle" fill="${t.subtext}">tokens</text>
${legend}
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }, donutKeyframes));
}

export const CARDS = {
  summary: renderSummary,
  activity: renderActivity,
  models: renderModels,
};
