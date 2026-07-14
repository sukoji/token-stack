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

const SKY_PHASES = {
  dawn: { sky: ["#32436d", "#d58a7d", "#f4c98e"], luminary: "#fff0bd", field: "#527b4f", grass: "#d7e79d", window: "#fff3cc", stars: true, palette: { house: ["#cf7b52", "#e0a25b", "#b9674a", "#d89b68", "#c77961"], midrise: ["#5b8d98", "#6e87a9", "#579b92", "#7f82a9", "#5a8494"], highrise: ["#587dc0", "#776fbc", "#5d9bc1", "#826caa", "#527da2"], landmark: ["#aa77dd", "#679cf2", "#d878b2", "#70bdca", "#cb8a58"] } },
  day: { sky: ["#69bce0", "#b8e4eb", "#f4d7a8"], luminary: "#fff1a4", field: "#5d9154", grass: "#d6e891", window: "#eaf5f2", stars: false, palette: { house: ["#d9794d", "#e0a05d", "#bd6847", "#d89362", "#c8775c"], midrise: ["#6f9294", "#7e91a6", "#6a9b8b", "#8792aa", "#668b96"], highrise: ["#597e98", "#6c79a0", "#548f9c", "#7c769b", "#517f91"], landmark: ["#707bb0", "#587fae", "#a2749f", "#5d9096", "#a47e5e"] } },
  dusk: { sky: ["#26365c", "#9b5c75", "#ea9c6a"], luminary: "#ffe0a3", field: "#426c49", grass: "#bddb83", window: "#fff0bc", stars: true, palette: { house: ["#c96f4f", "#dc9758", "#ad5f49", "#d28762", "#bd7058"], midrise: ["#4f7f91", "#6376a2", "#4b8e86", "#716ea1", "#4d748d"], highrise: ["#4c70b5", "#6a5cb0", "#4f90b2", "#755ca8", "#496e9c"], landmark: ["#9d61d8", "#5591ee", "#cf6ba5", "#57adbd", "#c47e4d"] } },
  night: { sky: ["#11183e", "#36306c", "#95627a"], luminary: "#fff4c7", field: "#315240", grass: "#a7d78d", window: "#fff3c4", stars: true, palette: { house: ["#af6048", "#c48a4e", "#985044", "#ba7959", "#a95d50"], midrise: ["#3b7585", "#526b98", "#3b8379", "#5c6795", "#416d82"], highrise: ["#426daf", "#6258a8", "#3f8dae", "#6d55a1", "#3e6f99"], landmark: ["#925ad0", "#4b8ce9", "#bd6297", "#55aabb", "#b9774c"] } },
};

function resolveSkyPhase(sky = "auto", now) {
  if (SKY_PHASES[sky]) return { name: sky, ...SKY_PHASES[sky] };
  if (sky !== "auto") throw new Error(`Unknown sky "${sky}". Available: auto, ${Object.keys(SKY_PHASES).join(", ")}`);
  const date = now ? new Date(now) : new Date();
  const hour = Number.isNaN(date.getTime()) ? new Date().getHours() : date.getHours();
  const name = hour >= 5 && hour < 8 ? "dawn" : hour >= 8 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "dusk" : "night";
  return { name, ...SKY_PHASES[name] };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function skylineQuantile(values, percentile) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 1;
  return sorted[Math.floor((sorted.length - 1) * percentile)] || 1;
}

function skylineSample(values, position) {
  const left = clamp(Math.floor(position), 0, values.length - 1);
  const right = clamp(left + 1, 0, values.length - 1);
  const fraction = position - Math.floor(position);
  return values[left] * (1 - fraction) + values[right] * fraction;
}

function skylineHash(index) {
  return ((index * 1103515245 + 12345) >>> 0) / 0x100000000;
}

function skylineShape(tier, shape, x, width, base, height) {
  const left = x.toFixed(1);
  const right = (x + width).toFixed(1);
  const center = (x + width / 2).toFixed(1);
  const top = base - height;
  const at = (ratio) => (x + width * ratio).toFixed(1);
  if (tier === "house") {
    return shape % 3 === 0
      ? `M${left} ${base}V${top + 6}L${center} ${top}L${right} ${top + 6}V${base}Z`
      : shape % 3 === 1
        ? `M${left} ${base}V${top + 5}H${at(.2)}L${center} ${top}L${at(.8)} ${top + 5}H${right}V${base}Z`
        : `M${left} ${base}V${top + 4}H${at(.16)}V${top}H${at(.72)}V${top + 4}H${right}V${base}Z`;
  }
  if (tier === "midrise") {
    return [
      `M${left} ${base}V${top + 5}H${at(.15)}V${top}H${right}V${base}Z`,
      `M${left} ${base}V${top + 9}H${at(.24)}V${top + 3}H${at(.74)}V${top}H${right}V${base}Z`,
      `M${left} ${base}V${top + 7}Q${center} ${top - 3} ${right} ${top + 7}V${base}Z`,
      `M${left} ${base}V${top + 8}L${at(.25)} ${top}H${at(.75)}L${right} ${top + 8}V${base}Z`,
      `M${left} ${base}V${top}H${right}V${base}Z`,
    ][shape % 5];
  }
  if (tier === "highrise") {
    return [
      `M${left} ${base}V${top + 14}H${at(.16)}V${top + 5}H${at(.32)}V${top}H${at(.72)}V${top + 7}H${right}V${base}Z`,
      `M${left} ${base}V${top + 13}L${at(.18)} ${top + 4}L${center} ${top}L${at(.82)} ${top + 7}V${base}Z`,
      `M${left} ${base}V${top + 10}H${at(.28)}V${top}H${at(.7)}V${top + 10}H${right}V${base}Z`,
      `M${left} ${base}V${top + 8}Q${center} ${top - 7} ${right} ${top + 8}V${base}Z`,
      `M${left} ${base}V${top + 12}H${at(.2)}V${top + 3}H${at(.8)}V${top + 12}H${right}V${base}Z`,
    ][shape % 5];
  }
  return [
    `M${left} ${base}V${top + 24}L${at(.18)} ${top + 10}L${at(.4)} ${top}H${at(.62)}L${at(.84)} ${top + 13}V${base}Z`,
    `M${left} ${base}V${top + 28}L${at(.22)} ${top + 12}L${center} ${top}L${at(.78)} ${top + 18}V${base}Z`,
    `M${left} ${base}V${top + 20}Q${at(.22)} ${top + 2} ${center} ${top}Q${at(.8)} ${top + 3} ${right} ${top + 22}V${base}Z`,
    `M${left} ${base}V${top + 26}H${at(.24)}V${top + 8}H${at(.4)}V${top}H${at(.62)}V${top + 11}H${at(.82)}V${top + 26}H${right}V${base}Z`,
    `M${left} ${base}V${top + 24}L${at(.3)} ${top + 5}L${center} ${top}L${at(.7)} ${top + 5}V${base}Z`,
  ][shape % 5];
}

function chartSkylineContinuous(days, t, box, { anim, speed, sky = "auto", now } = {}) {
  const { x, y, w, h } = box;
  const phase = resolveSkyPhase(sky, now);
  const detail = w >= 390 && h >= 95;
  const cap = skylineQuantile(days.map((day) => day.total), 0.9);
  const raw = days.map((day) => clamp(Math.log1p(day.total) / Math.log1p(cap), 0, 1));
  const smooth = raw.map((_, index) => {
    const weights = [0.1, 0.2, 0.4, 0.2, 0.1];
    return weights.reduce((sum, weight, offset) => sum + (raw[clamp(index + offset - 2, 0, raw.length - 1)] * weight), 0);
  });
  const heightScore = raw.map((value, index) => value * 0.7 + smooth[index] * 0.3);
  const densityScore = raw.map((value, index) => value * 0.25 + smooth[index] * 0.75);
  const base = y + h - (detail ? 7 : 5);
  const lots = clamp(days.length * (detail ? 2 : 1), 24, detail ? 72 : 48);
  const lotWidth = w / lots;
  const backgroundLots = Math.max(20, Math.round(lots * 0.72));
  const defs = [`<clipPath id="skylineScene"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/></clipPath>`];
  const background = [];
  const fabricPoints = [];
  const foreground = [];
  let buildingIndex = 0;

  const addBuilding = ({ id, tier, shape, left, width, height, color, opacity = 1, label, delayIndex, prominence = 0 }) => {
    const path = skylineShape(tier, shape, left, width, base, height);
    const clipId = `skylineClip${id}`;
    const top = base - height;
    defs.push(`<clipPath id="${clipId}"><path d="${path}"/></clipPath>`);
    const facadeWidth = Math.max(1, width * (tier === "landmark" ? 0.24 : 0.18));
    const face = `<rect x="${(left + width - facadeWidth).toFixed(1)}" y="${top.toFixed(1)}" width="${facadeWidth.toFixed(1)}" height="${height.toFixed(1)}" fill="#101827" fill-opacity="${phase.name === "day" ? ".12" : ".24"}"/>`;
    let windows = "";
    if (detail && width >= 5) {
      const cols = tier === "house" ? 1 : clamp(Math.floor(width / 3.8), 1, 4);
      const rows = tier === "house" ? 1 : clamp(Math.floor((height - 9) / (tier === "landmark" ? 6.5 : 8)), 1, 14);
      const startY = top + Math.min(11, height * 0.33);
      windows = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
        const wx = left + width * .14 + ((width * .72) * (col + .5) / cols);
        const wy = startY + row * (tier === "landmark" ? 6.5 : 8);
        const on = skylineHash((delayIndex + 1) * 97 + row * 11 + col * 23) > (phase.name === "night" ? .16 : .42);
        return `<rect class="skyline-window" x="${(wx - .8).toFixed(1)}" y="${wy.toFixed(1)}" width="1.6" height="${tier === "landmark" ? "2" : "2.4"}" rx=".4" fill="${phase.window}" fill-opacity="${on ? (phase.name === "night" ? ".92" : ".58") : ".14"}"/>`;
      }).join("")).join("");
    } else if (width >= 3.5) {
      windows = `<path d="M${(left + width * .5).toFixed(1)} ${top + 4}V${base - 3}" stroke="${phase.window}" stroke-opacity=".35" stroke-width=".7"/>`;
    }
    const crown = prominence > .72 ? `<path d="M${(left + width / 2).toFixed(1)} ${top - Math.min(12, height * .16)}v${Math.min(12, height * .16)}" stroke="${phase.window}" stroke-opacity=".82" stroke-width="${tier === "landmark" ? "1.1" : ".7"}"/>` : "";
    foreground.push(`<g class="skyline-${tier}"><title>${label}</title><path class="by skyline-building skyline-${tier}-${shape % 5}" style="${delay(delayIndex, .025, speed)}" d="${path}" fill="${color}" fill-opacity="${opacity}"/>${crown}<g clip-path="url(#${clipId})">${face}${windows}</g></g>`);
  };

  for (let i = 0; i < backgroundLots; i++) {
    const position = (i + .5) * (days.length - 1) / backgroundLots;
    const density = skylineSample(densityScore, position);
    const height = 6 + density * (detail ? 21 : 15) + skylineHash(i + 31) * 5;
    const left = x + i * (w / backgroundLots) - .4;
    const width = w / backgroundLots + .9;
    const color = phase.palette.midrise[i % phase.palette.midrise.length];
    background.push(`<rect x="${left.toFixed(1)}" y="${(base - height).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${color}" fill-opacity=".26"/>`);
  }

  for (let i = 0; i <= days.length; i++) {
    const density = skylineSample(densityScore, clamp(i, 0, days.length - 1));
    fabricPoints.push(`${(x + (i / days.length) * w).toFixed(1)},${(base - 4 - density * 16).toFixed(1)}`);
  }

  for (let i = 0; i < lots; i++) {
    const position = (i + .5) * (days.length - 1) / lots;
    const density = skylineSample(densityScore, position);
    const heightValue = skylineSample(heightScore, position);
    const dayIndex = clamp(Math.round(position), 0, days.length - 1);
    const left = x + i * lotWidth - .35;
    const width = lotWidth + .8;
    const shape = Math.floor(skylineHash(i * 17 + dayIndex * 5) * 5);
    const idle = density < .075 && raw[dayIndex] === 0;
    if (idle) {
      const treeHeight = 4 + skylineHash(i + 91) * 6;
      foreground.push(`<g class="skyline-field"><path d="M${left.toFixed(1)} ${base}V${(base - 3).toFixed(1)}q${(width / 2).toFixed(1)} -2 ${width.toFixed(1)} 0V${base}Z" fill="${phase.field}"/><circle cx="${(left + width * .5).toFixed(1)}" cy="${(base - treeHeight).toFixed(1)}" r="${Math.max(1.3, width * .18).toFixed(1)}" fill="${phase.grass}" fill-opacity=".9"/><path d="M${(left + width * .5).toFixed(1)} ${base - 2}v${-(treeHeight - 2)}" stroke="#384c38" stroke-width=".8"/></g>`);
      continue;
    }
    const tier = heightValue < .22 ? "house" : heightValue < .48 ? "midrise" : "highrise";
    const height = tier === "house" ? 8 + heightValue * 22 : tier === "midrise" ? 13 + heightValue * 34 : 22 + heightValue * 43;
    addBuilding({
      id: `lot${i}`,
      tier,
      shape,
      left,
      width,
      height,
      color: phase.palette[tier][shape],
      opacity: .96,
      label: `${days[dayIndex].date}: ${formatTokens(days[dayIndex].total)} activity district`,
      delayIndex: buildingIndex++,
      prominence: heightValue,
    });
  }

  const candidatePeaks = raw.map((value, index) => ({ value, index }))
    .filter(({ value, index }) => value > .48 && value >= (raw[index - 1] ?? 0) && value >= (raw[index + 1] ?? 0))
    .sort((a, b) => b.value - a.value);
  const peaks = [];
  for (const candidate of candidatePeaks) {
    if (peaks.every((peak) => Math.abs(peak.index - candidate.index) > 2)) peaks.push(candidate);
    if (peaks.length === (detail ? 6 : 3)) break;
  }
  if (!peaks.length && Math.max(...raw, 0) > .2) peaks.push({ index: raw.indexOf(Math.max(...raw)), value: Math.max(...raw) });
  for (const { index, value } of peaks.sort((a, b) => a.index - b.index)) {
    const dayWidth = w / days.length;
    const width = Math.max(7, dayWidth * (.62 + value * .18));
    const left = x + (index + .5) * dayWidth - width / 2;
    const shape = Math.floor(skylineHash(index * 41 + 7) * 5);
    const height = Math.min(h * .87, 36 + heightScore[index] * h * .62);
    addBuilding({
      id: `peak${index}`,
      tier: "landmark",
      shape,
      left,
      width,
      height,
      color: phase.palette.landmark[shape],
      label: `${days[index].date}: ${formatTokens(days[index].total)} activity landmark`,
      delayIndex: buildingIndex++,
      prominence: value,
    });
  }

  const stars = phase.stars ? Array.from({ length: detail ? 20 : 10 }, (_, i) => {
    const sx = x + 12 + ((i * 47) % Math.max(20, w - 24));
    const sy = y + 9 + ((i * 19) % Math.max(12, Math.floor(h * .38)));
    return `<circle class="sky-star" style="${delay(i, .08, speed)}" cx="${sx}" cy="${sy}" r="${i % 3 === 0 ? 1.25 : .75}" fill="${phase.window}"/>`;
  }).join("") : "";
  const clouds = phase.name === "day" || phase.name === "dawn" ? `<g class="f" style="${delay(1, .1, speed)}" fill="#ffffff" fill-opacity="${phase.name === "day" ? ".48" : ".28"}"><circle cx="${x + w * .2}" cy="${y + h * .22}" r="${detail ? 12 : 7}"/><circle cx="${x + w * .24}" cy="${y + h * .2}" r="${detail ? 17 : 10}"/><circle cx="${x + w * .29}" cy="${y + h * .24}" r="${detail ? 11 : 7}"/><circle cx="${x + w * .67}" cy="${y + h * .3}" r="${detail ? 10 : 6}"/><circle cx="${x + w * .71}" cy="${y + h * .27}" r="${detail ? 15 : 9}"/></g>` : "";
  const fabric = `<polygon class="skyline-fabric" points="${x},${base} ${fabricPoints.join(" ")} ${x + w},${base}" fill="${phase.palette.midrise[0]}" fill-opacity=".42"/>`;
  const street = `<path class="skyline-street" d="M${x} ${base - 2}H${x + w}V${y + h}H${x}Z" fill="#18232d" fill-opacity=".78"/><path d="M${x} ${base + 1}H${x + w}" stroke="${phase.window}" stroke-opacity=".52" stroke-dasharray="9 7" stroke-width=".7"/>${Array.from({ length: Math.floor(w / 62) }, (_, i) => { const sx = x + 24 + i * 62; return `<path d="M${sx} ${base - 2}v-8m-2 0h4" stroke="${phase.window}" stroke-opacity=".56" stroke-width=".8"/><circle cx="${sx}" cy="${base - 11}" r="1.1" fill="${phase.window}" fill-opacity=".9"/>`; }).join("")}`;
  const svg = `<defs><linearGradient id="skylineSky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${phase.sky[0]}"/><stop offset=".58" stop-color="${phase.sky[1]}"/><stop offset="1" stop-color="${phase.sky[2]}"/></linearGradient><radialGradient id="skylineLuminary"><stop stop-color="#fffde1"/><stop offset="1" stop-color="${phase.luminary}"/></radialGradient>${defs.join("")}</defs><g clip-path="url(#skylineScene)"><rect data-sky="${phase.name}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#skylineSky)"/>${clouds}${stars}<circle class="f skyline-luminary" style="${delay(2, .12, speed)}" cx="${x + w - (detail ? 30 : 20)}" cy="${y + (detail ? 24 : 17)}" r="${detail ? 11 : 7}" fill="url(#skylineLuminary)"/>${background.join("")}${fabric}${foreground.join("")}${street}</g>`;
  const extraCss = anim ? `.sky-star{opacity:0;animation:twinkle ${(1.8 / speed).toFixed(2)}s ease-in-out infinite}.skyline-fabric{opacity:0;animation:fu ${(0.7 / speed).toFixed(2)}s cubic-bezier(.4,0,.2,1) forwards}@keyframes twinkle{50%{opacity:.3;transform:scale(.55)}}` : "";
  return { svg, extraCss };
}

const CHARTS = { bars: chartBars, line: chartLine, grass: chartGrass, skyline: chartSkylineContinuous };

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
  const { svg: chartSvg, extraCss } = drawChart(days, t, box, { anim, speed, sky: opts.sky, now: opts.now });

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
  const drawChart = chart === "skyline" ? chartSkylineContinuous : chartBars;
  const { svg: chartSvg, extraCss } = drawChart(days, t, { x: chartX, y: baseY - chartH, w: chartW, h: chartH }, { anim, speed, sky: opts.sky, now: opts.now });

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
