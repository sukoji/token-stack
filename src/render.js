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

function frame(w, h, t, title, body, style, scale = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${style}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>`;
}

function resolveTheme(name) {
  return THEMES[name] ?? THEMES.dark;
}

// Chart bodies for the compact card. Each fills the box {x, y, w, h} from
// stats.byDay and returns { svg, extraCss }.
function chartBars(days, t, box, { anim, speed }) {
  const { x, y, w, h } = box;
  const max = Math.max(...days.map((d) => d.total), 1);
  const bw = w / days.length - 2;
  const svg = days
    .map((d, i) => {
      const bh = Math.max(2, Math.round((d.total / max) * h));
      const bx = x + i * (w / days.length);
      return `<rect class="by" style="${delay(i, 0.025, speed)}" x="${bx.toFixed(1)}" y="${y + h - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="2" fill="${i === days.length - 1 ? t.big[1] : t.bars[0]}"/>`;
    })
    .join("\n");
  return { svg: svg + `\n<line x1="${x}" y1="${y + h + 1}" x2="${x + w}" y2="${y + h + 1}" stroke="${t.border}"/>`, extraCss: "" };
}

function chartLine(days, t, box, { anim, speed }) {
  const { x, y, w, h } = box;
  const max = Math.max(...days.map((d) => d.total), 1);
  const pt = (d, i) =>
    `${(x + (i / (days.length - 1)) * w).toFixed(1)},${(y + h - (d.total / max) * (h - 4)).toFixed(1)}`;
  const points = days.map(pt).join(" ");
  const [lx, ly] = pt(days[days.length - 1], days.length - 1).split(",");
  const line = anim
    ? `<polyline class="draw" pathLength="1" points="${points}" fill="none" stroke="${t.bars[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    : `<polyline points="${points}" fill="none" stroke="${t.bars[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const svg = `
<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="${t.bars[0]}" stop-opacity="0.35"/><stop offset="100%" stop-color="${t.bars[0]}" stop-opacity="0"/>
</linearGradient></defs>
<polygon class="f" style="${delay(6, 0.12, speed)}" points="${x},${y + h} ${points} ${x + w},${y + h}" fill="url(#area)"/>
${line}
<circle class="f" style="${delay(7, 0.12, speed)}" cx="${lx}" cy="${ly}" r="3.5" fill="${t.big[1]}"/>
<line x1="${x}" y1="${y + h + 1}" x2="${x + w}" y2="${y + h + 1}" stroke="${t.border}"/>`;
  const extraCss = anim
    ? `.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:dr ${(1.2 / speed).toFixed(2)}s cubic-bezier(.4,0,.2,1) forwards ${(0.2 / speed).toFixed(2)}s}\n@keyframes dr{to{stroke-dashoffset:0}}`
    : "";
  return { svg, extraCss };
}

function chartGrass(days, t, box, { anim, speed }) {
  const { x, y, w, h } = box;
  // GitHub-style: columns are weeks, rows are weekdays (Sun-Sat).
  const firstDow = new Date(days[0].date + "T00:00:00").getDay();
  const weeks = Math.ceil((days.length + firstDow) / 7);
  const cell = Math.min(Math.floor(h / 7) - 2, Math.floor(w / weeks) - 2, 12);
  const step = cell + 3;
  const gridW = weeks * step - 3;
  const ox = x + Math.max(0, (w - gridW) / 2);
  const nonzero = days.filter((d) => d.total > 0).map((d) => d.total).sort((a, b) => a - b);
  const q = (p) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 1;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const svg = days
    .map((d, i) => {
      const slot = i + firstDow;
      const cx = ox + Math.floor(slot / 7) * step;
      const cy = y + (slot % 7) * step;
      const op = d.total === 0 ? 0 : d.total <= q1 ? 0.3 : d.total <= q2 ? 0.55 : d.total <= q3 ? 0.8 : 1;
      const fill = op === 0 ? `fill="${t.track}"` : `fill="${t.bars[0]}" fill-opacity="${op}"`;
      return `<rect class="f" style="${delay(i, 0.012, speed)}" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${cell}" height="${cell}" rx="2.5" ${fill}><title>${d.date}: ${formatTokens(d.total)}</title></rect>`;
    })
    .join("\n");
  return { svg, extraCss: "" };
}

function chartSkyline(days, t, box, { anim, speed }) {
  const { x, y, w, h } = box;
  const max = Math.max(...days.map((d) => d.total), 1);
  const step = w / days.length;
  const bw = Math.max(1.5, step - 1.2);
  const stars = Array.from({ length: Math.min(16, Math.max(7, Math.floor(w / 28))) }, (_, i) => {
    const sx = x + 12 + ((i * 47) % Math.max(20, w - 24));
    const sy = y + 10 + ((i * 19) % Math.max(15, Math.floor(h * 0.46)));
    return `<circle class="sky-star" style="${delay(i, 0.08, speed)}" cx="${sx}" cy="${sy}" r="${i % 3 === 0 ? 1.3 : 0.8}" fill="#fff3c4"/>`;
  }).join("");
  const buildings = days.map((d, i) => {
    const raw = d.total / max;
    const bh = d.total === 0 ? Math.max(4, Math.round(h * 0.08)) : Math.max(8, Math.round((0.15 + raw * 0.82) * h));
    const bx = x + i * step + 0.6;
    const base = y + h;
    const top = base - bh;
    const fill = i === days.length - 1 ? t.big[1] : t.bars[0];
    const type = (i * 11 + Math.round(raw * 19)) % 6;
    const left = bx.toFixed(1), right = (bx + bw).toFixed(1), center = (bx + bw / 2).toFixed(1);
    const silhouette = bw < 7 || bh < 20
      ? `<rect class="by skyline-building" style="${delay(i, 0.025, speed)}" x="${left}" y="${top}" width="${bw.toFixed(1)}" height="${bh}" rx="${Math.min(2, bw / 2).toFixed(1)}" fill="${fill}"/>`
      : (() => {
        const dPath = [
          `M${left} ${base}V${top}H${right}V${base}Z`,
          `M${left} ${base}V${top + 9}H${(bx + bw * .2).toFixed(1)}V${top}H${(bx + bw * .72).toFixed(1)}V${top + 5}H${right}V${base}Z`,
          `M${left} ${base}V${top + 10}L${center} ${top}L${right} ${top + 10}V${base}Z`,
          `M${left} ${base}V${top + 8}Q${center} ${top - 3} ${right} ${top + 8}V${base}Z`,
          `M${left} ${base}V${top + 11}H${(bx + bw * .38).toFixed(1)}V${top}H${(bx + bw * .62).toFixed(1)}V${top + 11}H${right}V${base}Z`,
          `M${left} ${base}V${top + 6}H${(bx + bw * .3).toFixed(1)}V${top + 2}H${(bx + bw * .7).toFixed(1)}V${top + 6}H${right}V${base}Z`,
        ][type];
        return `<path class="by skyline-building skyline-roof-${type}" style="${delay(i, 0.025, speed)}" d="${dPath}" fill="${fill}"/>`;
      })();
    const antenna = (type === 0 || type === 4) && bh > 26 ? `<path d="M${center} ${top - 6}v6" stroke="#fff3c4" stroke-opacity=".72"/>` : "";
    const windows = bw >= 7 && bh >= 20
      ? Array.from({ length: Math.floor((bh - 13) / 9) }, (_, row) => `<rect x="${(bx + bw * .32).toFixed(1)}" y="${(top + 10 + row * 9).toFixed(1)}" width="${Math.max(1, bw * .2).toFixed(1)}" height="2" rx=".5" fill="#fff3c4" fill-opacity="${row % 2 ? ".48" : ".8"}"/>`).join("")
      : "";
    return `<g><title>${d.date}: ${formatTokens(d.total)}</title>${silhouette}${antenna}${windows}</g>`;
  }).join("");
  const svg = `<defs><linearGradient id="skylineSky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1b1b4b"/><stop offset=".58" stop-color="#4d3677"/><stop offset="1" stop-color="#ec7f65"/></linearGradient><radialGradient id="skylineMoon"><stop stop-color="#fff9d4"/><stop offset="1" stop-color="#ffd88a"/></radialGradient></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#skylineSky)"/>${stars}<circle class="f" style="${delay(2, 0.12, speed)}" cx="${x + w - 27}" cy="${y + 23}" r="10" fill="url(#skylineMoon)"/>${buildings}<path d="M${x} ${y + h + .5}H${x + w}" stroke="#ffd6a1" stroke-opacity=".72"/>`;
  const extraCss = anim ? `.sky-star{opacity:0;animation:twinkle ${(1.8 / speed).toFixed(2)}s ease-in-out infinite}@keyframes twinkle{50%{opacity:.3;transform:scale(.55)}}` : "";
  return { svg, extraCss };
}

const CHARTS = { bars: chartBars, line: chartLine, grass: chartGrass, skyline: chartSkyline };

// 340x200 — same footprint as github-profile-summary-cards, so the two sit
// side by side in a README without height mismatch. `chart` picks how the
// daily trend is drawn: bars (default) | line | grass.
export function renderSummaryCompact(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Token Stack", chart = "bars" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 340, H = 200;
  const { totals } = stats;
  const days = stats.byDay;

  const drawChart = CHARTS[chart];
  if (!drawChart) throw new Error(`Unknown chart "${chart}". Available: ${Object.keys(CHARTS).join(", ")}`);
  const box = { x: 20, y: 100, w: W - 40, h: 72 };
  const { svg: chartSvg, extraCss } = drawChart(days, t, box, { anim, speed });

  const windowTotal = days.reduce((a, d) => a + d.total, 0);
  const body = `
<defs><linearGradient id="big" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="${t.big[0]}"/><stop offset="100%" stop-color="${t.big[1]}"/>
</linearGradient></defs>
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="20" y="27" font-size="14" font-weight="600" fill="${t.title}">⚡ ${esc(title)}</text>
<text class="f" style="${delay(1, 0.12, speed)}" x="20" y="66" font-size="30" font-weight="800" fill="url(#big)">${formatTokens(totals.total)}</text>
<text class="f" style="${delay(2, 0.12, speed)}" x="20" y="85" font-size="10.5" fill="${t.subtext}">tokens all time · est. ${formatCost(totals.cost)} · 🔥 ${stats.streak}d streak</text>
<text class="f" style="${delay(3, 0.12, speed)}" x="${W - 20}" y="97" font-size="9.5" text-anchor="end" fill="${t.subtext}">last ${days.length}d · ${formatTokens(windowTotal)}</text>
${chartSvg}
<text class="f" style="${delay(8, 0.12, speed)}" x="20" y="${H - 10}" font-size="9.5" fill="${t.subtext}">in ${formatTokens(totals.input)} · out ${formatTokens(totals.output)} · cache ${formatTokens(totals.cacheRead + totals.cacheWrite)}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }, extraCss), opts.scale);
}

export function renderSummary(stats, opts = {}) {
  if (opts.compact) return renderSummaryCompact(stats, opts);
  const { speed = 1, anim = true, title = "Token Stack · Claude Code", breakdown = "log" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495, H = 250;
  const { totals } = stats;

  const rows = [
    ["Input", totals.input],
    ["Output", totals.output],
    ["Cache read", totals.cacheRead],
    ["Cache write", totals.cacheWrite],
  ];
  // Cache reads can be thousands of times larger than request I/O. Log bars
  // retain that ordering while keeping smaller categories useful to compare.
  const compare = (value) => breakdown === "raw" ? value : Math.log10(value + 1);
  const maxRow = Math.max(...rows.map((r) => compare(r[1])), 1);
  const rowsSvg = rows
    .map(([label, val], i) => {
      const y = 128 + i * 25;
      const w = Math.max(2, Math.round((compare(val) / maxRow) * 108));
      return `<g class="f" style="${delay(i + 3, 0.12, speed)}">
<text x="25" y="${y + 5}" font-size="11" fill="${t.text}">${label}</text>
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
<text class="f" style="${delay(2, 0.12, speed)}" x="255" y="97" font-size="10" text-anchor="end" fill="${t.subtext}">${breakdown === "log" ? "relative log scale" : "raw token scale"}</text>
${rowsSvg}
<text class="f" style="${delay(3, 0.12, speed)}" x="${chartX}" y="112" font-size="11" fill="${t.subtext}">last 14 days · ${formatTokens(sparkTotal)}</text>
${spark}
<line x1="${chartX}" y1="${baseY + 1}" x2="${chartX + chartW}" y2="${baseY + 1}" stroke="${t.border}"/>
<text class="f" style="${delay(8, 0.12, speed)}" x="25" y="${H - 18}" font-size="11" fill="${t.subtext}">${footer}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }), opts.scale);
}

export function renderActivity(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Token Activity", chart = "bars" } = opts;
  const t = resolveTheme(opts.theme);
  const days = stats.byDay;
  const W = 495, H = 220;
  const chartX = 25, chartW = W - 50, baseY = 178, chartH = 108;
  const windowTotal = days.reduce((a, d) => a + d.total, 0);
  const windowCost = days.reduce((a, d) => a + d.cost, 0);
  const drawChart = chart === "skyline" ? chartSkyline : chartBars;
  const { svg: chartSvg, extraCss } = drawChart(days, t, { x: chartX, y: baseY - chartH, w: chartW, h: chartH }, { anim, speed });

  const body = `
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="25" y="33" font-size="16" font-weight="600" fill="${t.title}">📊 ${esc(title)}</text>
<text class="f" style="${delay(1, 0.12, speed)}" x="${W - 25}" y="33" font-size="12" text-anchor="end" fill="${t.subtext}">${formatTokens(windowTotal)} · ${formatCost(windowCost)} · ${days.length}d</text>
${chartSvg}
<text x="${chartX}" y="${baseY + 18}" font-size="10" fill="${t.subtext}">${days[0]?.date ?? ""}</text>
<text x="${chartX + chartW}" y="${baseY + 18}" font-size="10" text-anchor="end" fill="${t.subtext}">${days[days.length - 1]?.date ?? ""}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }, extraCss), opts.scale);
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
  return frame(W, H, t, title, body, styles({ anim, speed }, donutKeyframes), opts.scale);
}

export function renderAgents(stats, opts = {}) {
  const { speed = 1, anim = true, title = "AI Coding Agents" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495;
  const agents = (stats.byAgentActivity ?? []).slice(0, 6);
  // A single connected agent is common on first run. Keep that card compact
  // rather than leaving an unhelpful empty panel under one row.
  const H = Math.max(165, 78 + agents.length * 34);
  const total = Math.max(stats.agentSessions ?? agents.reduce((sum, agent) => sum + agent.sessions, 0), 1);
  const barX = 165, barW = 182, valueX = 470;
  const rows = agents.map((agent, i) => {
    const y = 70 + i * 34;
    const width = Math.max(2, Math.round((agent.sessions / total) * barW));
    const pct = ((agent.sessions / total) * 100).toFixed(1);
    return `<g class="f" style="${delay(i + 1, 0.12, speed)}"><text x="25" y="${y}" font-size="12" fill="${t.text}">${esc(agent.name)}</text><rect x="${barX}" y="${y - 10}" width="${barW}" height="9" rx="4.5" fill="${t.track}"/><rect class="bx" style="${delay(i + 1, 0.12, speed)}" x="${barX}" y="${y - 10}" width="${width}" height="9" rx="4.5" fill="${t.bars[i % t.bars.length]}"/><text x="${valueX}" y="${y}" font-size="11" text-anchor="end" fill="${t.subtext}">${pct}% · ${agent.sessions} session${agent.sessions === 1 ? "" : "s"}</text></g>`;
  }).join("\n");
  const hint = agents.length === 1
    ? `<text class="f" style="${delay(3, 0.12, speed)}" x="25" y="112" font-size="11" fill="${t.subtext}">Codex and Antigravity are auto-detected when installed.</text>`
    : "";
  const body = `<g font-family="'Segoe UI',Ubuntu,Sans-Serif"><text class="f" x="25" y="33" font-size="16" font-weight="600" fill="${t.title}">◈ ${esc(title)}</text><text class="f" style="${delay(1, 0.12, speed)}" x="470" y="33" font-size="11" text-anchor="end" fill="${t.subtext}">sessions · all time</text>${rows || `<text x="25" y="76" font-size="12" fill="${t.subtext}">No agent activity found yet.</text>`}${hint}</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed }), opts.scale);
}

function passportArchetype(stats) {
  const agents = stats.byAgentActivity ?? [];
  const sessions = Math.max(stats.agentSessions ?? 0, 1);
  const providers = agents.filter((agent) => agent.sessions > 0).length;
  const top = agents[0];
  const topShare = top ? top.sessions / sessions : 0;
  if (providers >= 3) return "Multi-Agent Operator";
  if (providers >= 2 && topShare < 0.8) return "Hybrid Builder";
  if (top?.name === "codex") return "Codex Operator";
  if (top?.name === "antigravity") return "Antigravity Explorer";
  if (stats.streak >= 14) return "Deep Work Runner";
  return "Claude Native";
}

export function renderPassport(stats, opts = {}) {
  const { speed = 1, anim = true, name = "LOCAL OPERATOR", season = "Season 01", archetype = "auto" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495, H = 280;
  const agents = (stats.byAgentActivity ?? []).filter((agent) => agent.sessions > 0);
  const label = archetype === "auto" ? passportArchetype(stats) : archetype;
  const models = stats.byModel?.filter((model) => model.total > 0).length ?? 0;
  const sessions = Math.max(stats.agentSessions ?? 0, 1);
  const avatar = typeof opts.avatarDataUri === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(opts.avatarDataUri)
    ? opts.avatarDataUri
    : "";
  const metrics = [
    ["SESSIONS", String(stats.agentSessions ?? 0)],
    ["AGENTS", String(agents.length)],
    ["STREAK", `${stats.streak ?? 0}d`],
    ["MODELS", String(models)],
  ];
  const metricSvg = metrics.map(([metric, value], i) => {
    const x = 25 + i * 82;
    return `<g class="f" style="${delay(i + 5, 0.08, speed)}"><text x="${x}" y="227" font-size="8" font-weight="700" letter-spacing="1.1" fill="${t.subtext}">${metric}</text><text x="${x}" y="250" font-size="19" font-weight="800" fill="${t.text}">${esc(value)}</text></g>`;
  }).join("");
  const agentSvg = agents.slice(0, 3).map((agent, i) => {
    const y = 140 + i * 22;
    const color = t.bars[i % t.bars.length];
    const share = Math.max(0.05, agent.sessions / sessions);
    const barWidth = Math.round(128 * share);
    return `<g class="f" style="${delay(i + 3, 0.1, speed)}"><circle cx="27" cy="${y - 3}" r="4" fill="${color}"/><text x="38" y="${y + 1}" font-size="10" font-weight="600" fill="${t.text}">${esc(agent.name)}</text><text x="193" y="${y + 1}" text-anchor="end" font-size="10" fill="${t.subtext}">${agent.sessions} sessions</text><rect x="38" y="${y + 7}" width="155" height="4" rx="2" fill="${t.track}"/><rect class="passport-bar" style="${delay(i + 4, 0.1, speed)}" x="38" y="${y + 7}" width="${barWidth}" height="4" rx="2" fill="${color}"/></g>`;
  }).join("");
  const core = avatar
    ? `<circle r="37" fill="${t.chip}" stroke="${t.big[0]}" stroke-width="2"/><image href="${avatar}" x="-33" y="-33" width="66" height="66" preserveAspectRatio="xMidYMid slice" clip-path="url(#passportAvatarClip)"/><circle cx="27" cy="27" r="7" fill="${t.bars[1]}" stroke="${t.bg}" stroke-width="3"/>`
    : `<circle r="37" fill="url(#passportCore)" stroke="${t.big[0]}" stroke-opacity=".55"/><path d="M-17 5 L-5 -9 L4 7 L18 -16" fill="none" stroke="${t.text}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="-16" r="3.5" fill="${t.bars[1]}"/>`;
  const radar = `<g transform="translate(397 125)"><g class="passport-orbit"><circle r="67" fill="none" stroke="${t.big[0]}" stroke-opacity=".18" stroke-width="1" stroke-dasharray="3 7"/><circle r="49" fill="none" stroke="${t.big[1]}" stroke-opacity=".32" stroke-width="1.5" stroke-dasharray="2 6"/></g>${core}<circle class="passport-pulse" r="26" fill="none" stroke="${t.big[1]}" stroke-width="1.5"/><circle class="passport-spark" cx="-59" cy="-26" r="3" fill="${t.bars[2]}"/><circle class="passport-spark late" cx="51" cy="35" r="2.5" fill="${t.big[1]}"/></g>`;
  const body = `<defs><linearGradient id="passport" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#111b3d"/><stop offset="54%" stop-color="${t.bg}"/><stop offset="100%" stop-color="#25183f"/></linearGradient><radialGradient id="passportGlow" cx="82%" cy="25%" r="58%"><stop offset="0%" stop-color="${t.big[1]}" stop-opacity=".25"/><stop offset="100%" stop-color="${t.bg}" stop-opacity="0"/></radialGradient><linearGradient id="passportCore" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${t.big[0]}"/><stop offset="1" stop-color="${t.big[1]}"/></linearGradient><clipPath id="passportAvatarClip"><circle r="33"/></clipPath></defs><rect x="1" y="1" width="493" height="278" rx="8" fill="url(#passport)"/><rect x="1" y="1" width="493" height="278" rx="8" fill="url(#passportGlow)"/><path d="M0 53 H495" stroke="${t.big[0]}" stroke-opacity=".16"/><path d="M220 1 V279" stroke="${t.big[1]}" stroke-opacity=".12"/><g font-family="'Segoe UI',Ubuntu,Sans-Serif"><g class="f"><circle cx="27" cy="29" r="5" fill="${t.bars[1]}"/><circle class="passport-live" cx="27" cy="29" r="5" fill="none" stroke="${t.bars[1]}"/><text x="40" y="33" font-size="10" font-weight="800" letter-spacing="1.3" fill="${t.title}">TOKEN STACK / AGENT PASSPORT</text><text x="470" y="33" text-anchor="end" font-size="9" font-weight="700" letter-spacing="1.1" fill="${t.subtext}">${esc(String(season).toUpperCase())}</text></g><text class="f" style="${delay(1, 0.1, speed)}" x="25" y="80" font-size="10" font-weight="700" letter-spacing="1.4" fill="${t.subtext}">${esc(String(name).toUpperCase())}</text><text class="f" style="${delay(2, 0.1, speed)}" x="25" y="114" font-size="25" font-weight="800" fill="${t.text}">${esc(label)}</text><text class="f" style="${delay(3, 0.1, speed)}" x="25" y="130" font-size="10" fill="${t.subtext}">LOCAL ACTIVITY PROFILE · EXPLAINABLE SIGNALS</text>${agentSvg}${radar}<rect x="15" y="207" width="465" height="59" rx="9" fill="${t.chip}" fill-opacity=".66" stroke="${t.border}" stroke-opacity=".7"/>${metricSvg}<text x="454" y="246" text-anchor="end" font-size="8" font-weight="700" letter-spacing="1" fill="${t.subtext}">PRIVATE BY DESIGN</text><text x="454" y="257" text-anchor="end" font-size="8" fill="${t.subtext}">local sessions only</text></g>`;
  const extraCss = `.passport-bar{transform:scaleX(0);transform-box:fill-box;transform-origin:left center;animation:gx ${(0.8 / speed).toFixed(2)}s cubic-bezier(.2,.6,.2,1) forwards}.passport-orbit{transform-origin:center;transform-box:fill-box;animation:spin ${(12 / speed).toFixed(2)}s linear infinite}.passport-pulse{transform-origin:center;transform-box:fill-box;animation:pulse ${(2.4 / speed).toFixed(2)}s ease-out infinite}@keyframes pulse{0%{opacity:.8;transform:scale(.65)}100%{opacity:0;transform:scale(1.55)}}.passport-live{transform-origin:center;transform-box:fill-box;animation:live ${(1.8 / speed).toFixed(2)}s ease-out infinite}@keyframes live{0%,100%{opacity:.8;transform:scale(1)}55%{opacity:0;transform:scale(2.2)}}.passport-spark{animation:twinkle ${(1.6 / speed).toFixed(2)}s ease-in-out infinite}@keyframes twinkle{50%{opacity:.25;transform:scale(.55)}}.passport-spark.late{animation-delay:${(0.7 / speed).toFixed(2)}s}`;
  return frame(W, H, t, `Agent Passport: ${label}`, body, styles({ anim, speed }, extraCss), opts.scale);
}

export const CARDS = {
  summary: renderSummary,
  activity: renderActivity,
  models: renderModels,
  agents: renderAgents,
  passport: renderPassport,
};
