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
  dawn: { sky: ["#32436d", "#d58a7d", "#f4c98e"], luminary: "#fff0bd", field: "#527b4f", grass: "#d7e79d", window: "#fff3cc", stars: true, palette: { house: ["#a66b57", "#b58567", "#8f6052", "#a97963", "#936b59"], midrise: ["#527784", "#687b8d", "#5d7d7b", "#786f82", "#547487"], highrise: ["#3d637c", "#4c647b", "#416d78", "#596274", "#3b5f75"], landmark: ["#466d88", "#3d607d", "#527787", "#526c7a", "#5c7180"] } },
  day: { sky: ["#69bce0", "#b8e4eb", "#f4d7a8"], luminary: "#fff1a4", field: "#5d9154", grass: "#d6e891", window: "#eaf5f2", stars: false, palette: { house: ["#ae7a61", "#be8b6a", "#9f705b", "#ad816a", "#956f5e"], midrise: ["#6b8692", "#7d9297", "#718c89", "#958b83", "#678390"], highrise: ["#4f6f7e", "#5c7582", "#537a82", "#6e7b84", "#4a6b7a"], landmark: ["#55788f", "#496d84", "#637f8d", "#547983", "#6e8590"] } },
  dusk: { sky: ["#26365c", "#9b5c75", "#ea9c6a"], luminary: "#ffe0a3", field: "#426c49", grass: "#bddb83", window: "#fff0bc", stars: true, palette: { house: ["#945e52", "#a4735c", "#81574d", "#99705d", "#865f54"], midrise: ["#486d7b", "#576a81", "#4e7472", "#6d6678", "#45687a"], highrise: ["#3c5875", "#4a5678", "#3d6674", "#57556f", "#3a5c72"], landmark: ["#466a86", "#3d5d79", "#4d7180", "#526778", "#4c6378"] } },
  night: { sky: ["#040713", "#0b1730", "#1b2a45"], luminary: "#f2f5ff", field: "#203f39", grass: "#759f76", window: "#ffd28a", stars: true, palette: { house: ["#253344", "#314153", "#22303f", "#2c3b4d", "#273747"], midrise: ["#1c3c55", "#274767", "#1f4a59", "#304560", "#21425b"], highrise: ["#153553", "#1d4164", "#164861", "#263f60", "#173d59"], landmark: ["#0d2b4c", "#153b61", "#11415d", "#1e3d59", "#123653"] } },
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
  // A small avalanche hash keeps the city deterministic without the visible
  // 3-step pattern produced by a linear congruential generator.
  let hash = index >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

function skylineLandmarkMetrics(shape, width, height) {
  const spire = Math.min(height * .18, Math.max(6, width * .48), 15);
  const step = Math.min(height * .11, Math.max(3.2, width * .18), 7);
  const roof = Math.min(height * .16, Math.max(4, width * .27), 10);
  const crown = [
    Math.min(height * .62, spire + step * 5 + 2),
    height * .52,
    height * .58,
    height * .68,
    height * .54,
  ][shape % 5];
  const windowStart = [
    Math.min(crown - 3, spire + step + 3),
    Math.min(crown - 3, roof * 1.5 + 4),
    Math.min(crown - 3, spire + roof * .6 + 3),
    Math.min(crown - 3, roof + 4),
    Math.min(crown - 3, roof + 4),
  ][shape % 5];
  const lightBand = Math.min(crown - 2, windowStart + step * 1.5);
  return { spire, step, roof, crown, windowStart, lightBand };
}

function skylineShape(tier, shape, x, width, base, height) {
  const left = x.toFixed(1);
  const right = (x + width).toFixed(1);
  const center = (x + width / 2).toFixed(1);
  const top = base - height;
  const at = (ratio) => (x + width * ratio).toFixed(1);
  const level = (ratio) => (top + height * ratio).toFixed(1);
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
      `M${left} ${base}V${top + 9}H${at(.18)}V${top + 4}H${at(.62)}V${top}H${at(.84)}V${top + 7}H${right}V${base}Z`,
      `M${left} ${base}V${top + 7}Q${at(.28)} ${top} ${at(.62)} ${top + 1}Q${at(.86)} ${top + 3} ${right} ${top + 7}V${base}Z`,
      `M${left} ${base}V${top + 8}H${at(.15)}V${top + 3}H${at(.85)}V${top + 8}H${right}V${base}Z`,
      `M${left} ${base}V${top + 5}H${at(.12)}V${top}H${at(.72)}V${top + 3}H${right}V${base}Z`,
    ][shape % 5];
  }
  if (tier === "highrise") {
    return [
      `M${left} ${base}V${top + 14}H${at(.12)}V${top + 6}H${at(.28)}V${top}H${at(.74)}V${top + 7}H${at(.9)}V${top + 14}H${right}V${base}Z`,
      `M${left} ${base}V${top + 13}H${at(.15)}V${top + 5}H${at(.34)}V${top}H${at(.7)}V${top + 5}H${at(.86)}V${top + 13}H${right}V${base}Z`,
      `M${left} ${base}V${top + 11}Q${at(.25)} ${top + 1} ${at(.52)} ${top}Q${at(.8)} ${top + 1} ${right} ${top + 11}V${base}Z`,
      `M${left} ${base}V${top + 12}H${at(.1)}V${top + 5}H${at(.3)}V${top}H${at(.62)}V${top + 8}H${at(.84)}V${top + 12}H${right}V${base}Z`,
      `M${left} ${base}V${top + 10}L${at(.14)} ${top + 4}H${at(.3)}V${top}H${at(.76)}L${at(.9)} ${top + 5}H${right}V${base}Z`,
    ][shape % 5];
  }
  const { spire, step, roof, crown } = skylineLandmarkMetrics(shape, width, height);
  return [
    // Tiered needle: an original setback tower with its mast inside the path.
    `M${left} ${base}V${level(.76)}H${at(.08)}V${level(.61)}H${at(.16)}V${level(.47)}H${at(.25)}V${level(.34)}H${at(.33)}V${level(.23)}H${at(.4)}V${level(.14)}H${at(.46)}L${center} ${top}L${at(.54)} ${level(.14)}H${at(.6)}V${level(.23)}H${at(.67)}V${level(.34)}H${at(.75)}V${level(.47)}H${at(.84)}V${level(.61)}H${at(.92)}V${level(.76)}H${right}V${base}Z`,
    // Split-fin prism: two unequal blades create a notched glass crown.
    `M${left} ${base}V${top + crown}L${at(.16)} ${top + roof * 1.45}H${at(.31)}V${top}H${at(.47)}V${top + roof * .8}H${at(.57)}V${top + roof * .25}H${at(.72)}L${at(.88)} ${top + roof * 1.55}L${right} ${top + crown}V${base}Z`,
    // Lantern tower: a narrow shaft, observation pod and integrated mast.
    `M${left} ${base}V${top + crown}H${at(.28)}V${top + spire + roof * 1.45}H${at(.18)}Q${at(.18)} ${top + spire + roof * .5} ${at(.34)} ${top + spire + roof * .28}L${at(.45)} ${top + spire}L${center} ${top}L${at(.55)} ${top + spire}L${at(.66)} ${top + spire + roof * .28}Q${at(.82)} ${top + spire + roof * .5} ${at(.82)} ${top + spire + roof * 1.45}H${at(.72)}V${top + crown}H${right}V${base}Z`,
    // Tapered twist: opposing slopes make a slim, asymmetric silhouette.
    `M${left} ${base}V${level(.72)}L${at(.1)} ${level(.72)}L${at(.24)} ${level(.45)}L${at(.36)} ${level(.2)}L${at(.43)} ${top}H${at(.57)}L${at(.7)} ${level(.2)}L${at(.84)} ${level(.45)}L${right} ${level(.72)}V${base}Z`,
    // Terraced crown: stacked, offset volumes for a dense financial district.
    `M${left} ${base}V${top + crown}H${at(.12)}V${top + roof * 1.75}H${at(.29)}V${top + roof * .65}H${at(.43)}V${top}H${at(.66)}V${top + roof}H${at(.82)}V${top + roof * 2}H${right}V${base}Z`,
  ][shape % 5];
}

function chartSkylineContinuous(days, t, box, { anim, speed, sky = "auto", now } = {}) {
  const { x, y, w, h } = box;
  const phase = resolveSkyPhase(sky, now);
  const detail = w >= 390 && h >= 95;
  const totals = days.map((day) => day.total);
  const logTotals = totals.map((total) => total > 0 ? Math.log1p(total) : 0);
  const positiveLogs = logTotals.filter(Boolean).sort((a, b) => a - b);
  const logLow = skylineQuantile(logTotals, .15);
  const logMedian = skylineQuantile(logTotals, .5);
  const logHigh = skylineQuantile(logTotals, .9);
  const logMin = positiveLogs[0] ?? 0;
  const logMax = positiveLogs.at(-1) ?? 0;
  const flatActivity = logHigh - logLow < .08;
  const rankWeight = positiveLogs.length >= 8 ? .42 : positiveLogs.length >= 4 ? .2 : 0;
  const tiedRank = (value) => {
    if (positiveLogs.length < 2) return .5;
    let lower = 0;
    let equal = 0;
    for (const candidate of positiveLogs) {
      if (candidate < value - .000001) lower++;
      else if (Math.abs(candidate - value) <= .000001) equal++;
    }
    return (lower + Math.max(0, equal - 1) / 2) / (positiveLogs.length - 1);
  };
  // `raw` is deliberately full-range (rather than p90-capped) so a genuine
  // burst can become one landmark.  `relative` is percentile/rank based so
  // normal days still show visible height differences in a dense city.
  const raw = logTotals.map((value, index) => {
    if (!totals[index]) return 0;
    return logMax - logMin < .000001 ? .5 : clamp((value - logMin) / (logMax - logMin), 0, 1);
  });
  const relative = logTotals.map((value, index) => {
    if (!totals[index]) return 0;
    if (positiveLogs.length === 1 || flatActivity) return .5;
    const magnitude = clamp((value - logLow) / Math.max(.000001, logHigh - logLow), 0, 1);
    return (1 - rankWeight) * magnitude + rankWeight * tiedRank(value);
  });
  const localPeakScore = relative.map((value, index) => {
    const previous = relative[clamp(index - 1, 0, relative.length - 1)];
    const next = relative[clamp(index + 1, 0, relative.length - 1)];
    return clamp((value - (previous + next) / 2) / .24, 0, 1);
  });
  const contrast = relative.map((value, index) => clamp(.88 * value ** 1.65 + .12 * localPeakScore[index], 0, 1));
  const smooth = contrast.map((_, index) => {
    const weights = [.05, .15, .6, .15, .05];
    return weights.reduce((sum, weight, offset) => sum + (contrast[clamp(index + offset - 2, 0, contrast.length - 1)] * weight), 0);
  });
  const heightScore = contrast.map((value, index) => value * .76 + smooth[index] * .24);
  const densityScore = contrast.map((value, index) => value * .25 + smooth[index] * .75);
  const cityScale = positiveLogs.length
    ? clamp((logMedian - Math.log1p(25_000)) / (Math.log1p(10_000_000) - Math.log1p(25_000)), 0, 1)
    : 0;
  const nightscape = phase.name === "night" || phase.name === "dusk";
  const waterDepth = nightscape ? (detail ? 15 : 9) : 0;
  const base = y + h - (waterDepth || (detail ? 7 : 5));
  const lots = clamp(
    Math.round(days.length * (detail ? .9 : 1.2)),
    Math.min(detail ? 12 : 18, days.length * 2),
    detail ? 42 : 30,
  );
  const lotWidth = w / lots;
  const backgroundLots = Math.max(20, Math.round(lots * 0.72));
  const defs = [`<clipPath id="skylineScene"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/></clipPath>`];
  const background = [];
  const fabricPoints = [];
  const foreground = [];
  const reflections = [];
  let buildingIndex = 0;

  const addBuilding = ({ id, tier, shape, left, width, height, color, opacity = 1, label, delayIndex, score = 0, density = 0 }) => {
    const path = skylineShape(tier, shape, left, width, base, height);
    const clipId = `skylineClip${id}`;
    const top = base - height;
    defs.push(`<clipPath id="${clipId}"><path d="${path}"/></clipPath>`);
    const facadeWidth = Math.max(1, width * (tier === "landmark" ? 0.24 : 0.18));
    const face = `<rect x="${(left + width - facadeWidth).toFixed(1)}" y="${top.toFixed(1)}" width="${facadeWidth.toFixed(1)}" height="${height.toFixed(1)}" fill="#101827" fill-opacity="${phase.name === "day" ? ".12" : ".24"}"/>`;
    const facadeLines = detail && tier !== "house" && width >= 9
      ? Array.from({ length: clamp(Math.floor(width / 8), 1, 4) }, (_, line) => {
        const lx = left + width * ((line + 1) / (clamp(Math.floor(width / 8), 1, 4) + 1));
        return `<path d="M${lx.toFixed(1)} ${(top + 3).toFixed(1)}V${(base - 2).toFixed(1)}" stroke="#122231" stroke-opacity="${tier === "landmark" ? ".25" : ".17"}" stroke-width=".65"/>`;
      }).join("")
      : "";
    let windows = "";
    let crownBand = "";
    if (detail && width >= 5) {
      const cols = tier === "house"
        ? 1
        : tier === "landmark" || tier === "highrise"
          ? clamp(Math.floor(width / 3.3), 2, 7)
          : clamp(Math.floor(width / 3.8), 1, 4);
      const gap = tier === "landmark" ? 6.5 : 8;
      const landmarkMetrics = tier === "landmark" ? skylineLandmarkMetrics(shape, width, height) : null;
      // Start landmark windows inside the usable shaft. The exact silhouette
      // also clips every facade detail, so tapered tiers stay clean.
      const startY = tier === "landmark"
        ? top + landmarkMetrics.windowStart
        : top + Math.min(11, height * 0.33);
      const rows = tier === "house"
        ? 1
        : clamp(Math.floor((base - 4 - startY) / gap), 1, tier === "landmark" || tier === "highrise" ? 16 : 14);
      const litProbability = phase.name === "night"
        ? clamp(.18 + density * .42 + (tier === "landmark" ? .12 : tier === "highrise" ? .06 : 0), .18, .76)
        : phase.name === "dusk"
          ? clamp(.28 + density * .32, .26, .68)
          : .58;
      const brightFloor = Math.floor(skylineHash((delayIndex + 13) * 43) * rows);
      windows = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
        const wx = left + width * .14 + ((width * .72) * (col + .5) / cols);
        const wy = startY + row * gap;
        const seed = skylineHash((delayIndex + 1) * 97 + row * 11 + col * 23);
        const on = seed < litProbability || (row === brightFloor && seed < litProbability + .22);
        const cool = phase.name === "night" && skylineHash((delayIndex + 5) * 71 + row * 17 + col * 29) > .72;
        const fill = cool ? "#9ed8ff" : phase.window;
        const windowClass = cool ? "skyline-window skyline-window-cool" : "skyline-window skyline-window-warm";
        return `<rect class="${windowClass}" x="${(wx - .8).toFixed(1)}" y="${wy.toFixed(1)}" width="1.6" height="${tier === "landmark" ? "2" : "2.4"}" rx=".4" fill="${fill}" fill-opacity="${on ? (phase.name === "night" ? ".9" : ".58") : ".1"}"/>`;
      }).join("")).join("");
      if (phase.name === "night" && tier === "landmark") {
        crownBand = `<rect class="skyline-crown-band" x="${(left + width * .23).toFixed(1)}" y="${(top + landmarkMetrics.lightBand).toFixed(1)}" width="${(width * .54).toFixed(1)}" height="1.1" fill="#9ed8ff" fill-opacity=".72"/>`;
      }
    } else if (width >= 3.5) {
      windows = `<path d="M${(left + width * .5).toFixed(1)} ${top + 4}V${base - 3}" stroke="${phase.window}" stroke-opacity=".35" stroke-width=".7"/>`;
    }
    foreground.push(`<g class="skyline-${tier}" data-height="${height.toFixed(1)}" data-width="${width.toFixed(1)}" data-score="${score.toFixed(3)}" data-density="${density.toFixed(3)}"><title>${label}</title><path class="by skyline-building skyline-${tier}-${shape % 5}" style="${delay(delayIndex, .025, speed)}" d="${path}" fill="${color}" fill-opacity="${opacity}"/><g clip-path="url(#${clipId})">${face}${facadeLines}${crownBand}${windows}</g></g>`);
    if (waterDepth && tier !== "house" && density > .04) {
      const reflectionHeight = Math.min(waterDepth - 3, Math.max(2, height * (tier === "landmark" ? .18 : tier === "highrise" ? .13 : .09)));
      const segments = tier === "landmark" || tier === "highrise" ? 3 : 2;
      for (let segment = 0; segment < segments; segment++) {
        const progress = segment / segments;
        const reflectionWidth = Math.max(2, width * (.78 - progress * .24));
        const reflectionX = left + (width - reflectionWidth) / 2 + (skylineHash(delayIndex * 53 + segment) - .5) * 2;
        const reflectionY = base + 2 + progress * reflectionHeight;
        reflections.push(`<rect class="skyline-reflection" x="${reflectionX.toFixed(1)}" y="${reflectionY.toFixed(1)}" width="${reflectionWidth.toFixed(1)}" height="${segment === 0 ? "1.1" : ".75"}" rx=".5" fill="${color}" fill-opacity="${tier === "landmark" ? ".36" : ".22"}"/>`);
      }
      if (tier === "landmark" || tier === "highrise") {
        const glowWidth = Math.max(2, width * .42);
        reflections.push(`<rect class="skyline-reflection skyline-reflection-light" x="${(left + (width - glowWidth) / 2).toFixed(1)}" y="${(base + 3).toFixed(1)}" width="${glowWidth.toFixed(1)}" height=".8" rx=".4" fill="${phase.window}" fill-opacity=".34"/>`);
      }
    }
  };

  for (let i = 0; i < backgroundLots; i++) {
    const position = (i + .5) * (days.length - 1) / backgroundLots;
    const density = skylineSample(densityScore, position);
    const height = 5 + cityScale * (detail ? 5 : 3) + density * (detail ? 12 : 9) + skylineHash(i + 31) * 3;
    const left = x + i * (w / backgroundLots) - .4;
    const width = w / backgroundLots + .9;
    const color = phase.palette.midrise[i % phase.palette.midrise.length];
    background.push(`<rect x="${left.toFixed(1)}" y="${(base - height).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${color}" fill-opacity=".26"/>`);
  }

  for (let i = 0; i <= days.length; i++) {
    const density = skylineSample(densityScore, clamp(i, 0, days.length - 1));
    fabricPoints.push(`${(x + (i / days.length) * w).toFixed(1)},${(base - 3 - density * (7 + cityScale * 7)).toFixed(1)}`);
  }

  for (let i = 0; i < lots; i++) {
    const position = (i + .5) * (days.length - 1) / lots;
    const density = skylineSample(densityScore, position);
    const heightValue = skylineSample(heightScore, position);
    const dayIndex = clamp(Math.round(position), 0, days.length - 1);
    const width = lotWidth * (.88 + skylineHash(i * 13 + dayIndex * 31) * .32) + .55;
    const left = x + i * lotWidth - (width - lotWidth) * .38 - .3;
    const shape = Math.floor(skylineHash(i * 17 + dayIndex * 5) * 5);
    const idle = density < .075 && totals[dayIndex] === 0;
    if (idle) {
      const treeHeight = 4 + skylineHash(i + 91) * 6;
      foreground.push(`<g class="skyline-field"><path d="M${left.toFixed(1)} ${base}V${(base - 3).toFixed(1)}q${(width / 2).toFixed(1)} -2 ${width.toFixed(1)} 0V${base}Z" fill="${phase.field}"/><circle cx="${(left + width * .5).toFixed(1)}" cy="${(base - treeHeight).toFixed(1)}" r="${Math.max(1.3, width * .18).toFixed(1)}" fill="${phase.grass}" fill-opacity=".9"/><path d="M${(left + width * .5).toFixed(1)} ${base - 2}v${-(treeHeight - 2)}" stroke="#384c38" stroke-width=".8"/></g>`);
      continue;
    }
    const supportsHighrise = heightValue > .56 && density > .48 && (localPeakScore[dayIndex] > .25 || skylineHash(i * 47 + dayIndex * 19) > .78);
    // Relative lows in a billion-token profile are still part of a downtown;
    // reserve detached homes for genuinely smaller overall activity scales.
    const houseThreshold = .16 * (1 - cityScale);
    const tier = heightValue < houseThreshold ? "house" : supportsHighrise ? "highrise" : "midrise";
    const computedHeight = tier === "house"
      ? 7 + cityScale * 4 + heightValue * 11
      : tier === "highrise"
        ? 42 + cityScale * 10 + (clamp((heightValue - .56) / .44, 0, 1) ** .85) * 25
        : 13 + cityScale * 9 + (clamp((heightValue - .16) / .6, 0, 1) ** 1.12) * 36;
    const heightCap = tier === "house"
      ? h * .3
      : tier === "highrise"
        ? h * (detail ? .72 : .66)
        : h * (detail ? .56 : .48);
    const height = Math.min(computedHeight, heightCap);
    const buildingWidth = tier === "highrise" ? width * .74 : width;
    const buildingLeft = left + (width - buildingWidth) / 2;
    addBuilding({
      id: `lot${i}`,
      tier,
      shape,
      left: buildingLeft,
      width: buildingWidth,
      height,
      color: phase.palette[tier][shape],
      opacity: .96,
      label: `${days[dayIndex].date}: ${formatTokens(days[dayIndex].total)} activity district`,
      delayIndex: buildingIndex++,
      score: heightValue,
      density,
    });
  }

  // Collapse equal-height plateaus before looking for peaks. Without this,
  // several equal-valued days become evenly spaced, identical towers.
  const candidatePeaks = [];
  for (let start = 0; start < raw.length;) {
    let end = start;
    while (end + 1 < raw.length && Math.abs(raw[end + 1] - raw[start]) < .0001) end++;
    const index = Math.floor((start + end) / 2);
    const value = raw[index];
    const previous = raw[start - 1] ?? -Infinity;
    const next = raw[end + 1] ?? -Infinity;
    const nearby = Math.max(
      raw[clamp(start - 3, 0, raw.length - 1)],
      raw[clamp(end + 3, 0, raw.length - 1)],
    );
    const prominence = value - nearby;
    if (value > .5 && value > previous + .005 && value > next + .005 && prominence > .075) {
      candidatePeaks.push({ value, index, prominence });
    }
    start = end + 1;
  }
  candidatePeaks.sort((a, b) => b.prominence - a.prominence || b.value - a.value || a.index - b.index);
  const peaks = [];
  for (const candidate of candidatePeaks) {
    if (peaks.every((peak) => Math.abs(peak.index - candidate.index) > Math.max(7, Math.round(days.length * .22)))) peaks.push(candidate);
    if (peaks.length === (detail ? 2 : 1)) break;
  }
  const rawMax = Math.max(...raw, 0);
  const rawMin = Math.min(...raw, rawMax);
  const rawRange = rawMax - rawMin;
  if (!peaks.length && rawRange > .35 && rawMax > .55) {
    const value = rawMax;
    peaks.push({ index: raw.indexOf(value), value, prominence: value });
  }
  const citySignature = days.reduce((signature, day, index) => {
    const numericDate = Number(day.date?.replaceAll("-", "")) || index;
    const magnitude = Math.round(Math.log1p(day.total) * 100);
    return (Math.imul(signature ^ numericDate, 33) ^ magnitude) >>> 0;
  }, 0x811c9dc5);
  const landmarkShapeOrder = [0, 2, 3, 4, 1];
  const landmarkRotation = Math.floor(skylineHash(citySignature) * landmarkShapeOrder.length);
  for (const [peakOrder, { index, value, prominence }] of peaks.sort((a, b) => a.index - b.index).entries()) {
    const dayWidth = w / days.length;
    const shape = landmarkShapeOrder[(landmarkRotation + peakOrder * 2) % landmarkShapeOrder.length];
    const baseWidth = clamp(dayWidth * (1.65 + value * .5), detail ? 16 : 12, detail ? 32 : 24);
    // Keep the skyline's focal towers visibly slender. Their podiums still
    // anchor them to the street, while the shafts read as needles and fins
    // instead of enlarged daily bars.
    const width = Math.max(detail ? 12 : 8.5, baseWidth * [.56, .62, .58, .6, .64][shape]);
    const centerX = x + (index + .5) * dayWidth;
    const left = clamp(centerX - width / 2, x, x + w - width);
    const height = clamp(h * (.39 + cityScale * .16 + heightScore[index] * .24 + prominence * .25), detail ? 46 : 28, h * .78);
    const podiumWidth = Math.max(width, Math.min(width * 1.45, dayWidth * 3.5));
    foreground.push(`<rect class="skyline-podium" x="${(left - (podiumWidth - width) / 2).toFixed(1)}" y="${(base - 10).toFixed(1)}" width="${podiumWidth.toFixed(1)}" height="10" fill="${phase.palette.midrise[(shape + 2) % phase.palette.midrise.length]}" fill-opacity=".94"/>`);
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
      score: heightScore[index],
      density: densityScore[index],
    });
  }

  const stars = phase.stars ? Array.from({ length: detail ? 20 : 10 }, (_, i) => {
    const sx = x + 12 + skylineHash(i * 67 + 19) * Math.max(20, w - 24);
    const sy = y + 9 + skylineHash(i * 83 + 41) * Math.max(12, Math.floor(h * .38));
    const radius = skylineHash(i * 101 + 7) > .72 ? 1.2 : .72;
    return `<circle class="sky-star" style="${delay(i, .08, speed)}" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${radius}" fill="${phase.window}"/>`;
  }).join("") : "";
  const clouds = phase.name === "day" || phase.name === "dawn" ? `<g class="f" style="${delay(1, .1, speed)}" fill="#ffffff" fill-opacity="${phase.name === "day" ? ".2" : ".16"}"><path d="M${(x + w * .08).toFixed(1)} ${(y + h * .25).toFixed(1)}c${(w * .022).toFixed(1)} -${(h * .09).toFixed(1)} ${(w * .065).toFixed(1)} -${(h * .09).toFixed(1)} ${(w * .084).toFixed(1)} 0c${(w * .022).toFixed(1)} -${(h * .055).toFixed(1)} ${(w * .072).toFixed(1)} -${(h * .045).toFixed(1)} ${(w * .084).toFixed(1)} ${(h * .035).toFixed(1)}H${(x + w * .26).toFixed(1)}c-${(w * .018).toFixed(1)} ${(h * .055).toFixed(1)} -${(w * .14).toFixed(1)} ${(h * .055).toFixed(1)} -${(w * .18).toFixed(1)} 0Z"/><path d="M${(x + w * .63).toFixed(1)} ${(y + h * .34).toFixed(1)}c${(w * .018).toFixed(1)} -${(h * .07).toFixed(1)} ${(w * .055).toFixed(1)} -${(h * .065).toFixed(1)} ${(w * .07).toFixed(1)} 0c${(w * .022).toFixed(1)} -${(h * .05).toFixed(1)} ${(w * .06).toFixed(1)} -${(h * .035).toFixed(1)} ${(w * .075).toFixed(1)} ${(h * .025).toFixed(1)}H${(x + w * .8).toFixed(1)}c-${(w * .014).toFixed(1)} ${(h * .045).toFixed(1)} -${(w * .12).toFixed(1)} ${(h * .045).toFixed(1)} -${(w * .17).toFixed(1)} 0Z"/></g>` : "";
  const fabric = `<polygon class="skyline-fabric" points="${x},${base} ${fabricPoints.join(" ")} ${x + w},${base}" fill="${phase.palette.midrise[0]}" fill-opacity=".42"/>`;
  const waterColors = phase.name === "night" ? ["#0a1828", "#12314d"] : ["#3d435a", "#233950"];
  const water = waterDepth ? `<g class="skyline-water"><rect x="${x}" y="${base + 1}" width="${w}" height="${y + h - base - 1}" fill="url(#skylineWater)"/><path d="M${x} ${base + 2}H${x + w}" stroke="${phase.window}" stroke-opacity=".2" stroke-width=".7"/>${Array.from({ length: detail ? 3 : 2 }, (_, i) => { const waveY = base + 5 + i * (detail ? 3 : 2); const waveX = x + ((i * 79) % 37); return `<path d="M${waveX.toFixed(1)} ${waveY.toFixed(1)}h${(w * (.38 + i * .12)).toFixed(1)}" stroke="${phase.window}" stroke-opacity="${i === 0 ? ".12" : ".08"}" stroke-width=".6"/>`; }).join("")}</g>` : "";
  const luminaryX = x + w - (detail ? 30 : 20);
  const luminaryY = y + (detail ? 24 : 17);
  const luminaryR = detail ? 11 : 7;
  const moonHalo = phase.name === "night" ? `<circle class="skyline-moon-halo" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR * 2.35}" fill="#d8e9ff" fill-opacity=".055"/><circle class="skyline-moon-halo" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR * 1.55}" fill="#d8e9ff" fill-opacity=".07"/>` : "";
  const street = waterDepth
    ? `<path class="skyline-street skyline-shore" d="M${x} ${base}H${x + w}" stroke="${phase.window}" stroke-opacity=".62" stroke-width="1"/>${Array.from({ length: Math.floor(w / 58) }, (_, i) => { const sx = x + 20 + i * 58; return `<circle class="skyline-shore-light" cx="${sx}" cy="${base - 1}" r="1.05" fill="${phase.window}" fill-opacity=".88"/><path d="M${sx - 3} ${base + 2}h6" stroke="${phase.window}" stroke-opacity=".23" stroke-width=".6"/>`; }).join("")}`
    : `<path class="skyline-street" d="M${x} ${base - 2}H${x + w}V${y + h}H${x}Z" fill="#18232d" fill-opacity=".78"/><path d="M${x} ${base + 1}H${x + w}" stroke="${phase.window}" stroke-opacity=".52" stroke-dasharray="9 7" stroke-width=".7"/>${Array.from({ length: Math.floor(w / 62) }, (_, i) => { const sx = x + 24 + i * 62; return `<path d="M${sx} ${base - 2}v-8m-2 0h4" stroke="${phase.window}" stroke-opacity=".56" stroke-width=".8"/><circle cx="${sx}" cy="${base - 11}" r="1.1" fill="${phase.window}" fill-opacity=".9"/>`; }).join("")}`;
  const svg = `<defs><linearGradient id="skylineSky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${phase.sky[0]}"/><stop offset=".58" stop-color="${phase.sky[1]}"/><stop offset="1" stop-color="${phase.sky[2]}"/></linearGradient><linearGradient id="skylineWater" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${waterColors[0]}"/><stop offset="1" stop-color="${waterColors[1]}"/></linearGradient><radialGradient id="skylineLuminary"><stop stop-color="#fffde1"/><stop offset="1" stop-color="${phase.luminary}"/></radialGradient>${defs.join("")}</defs><g clip-path="url(#skylineScene)"><rect data-sky="${phase.name}" data-city-scale="${cityScale.toFixed(3)}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#skylineSky)"/>${clouds}${stars}${moonHalo}<circle class="f skyline-luminary" style="${delay(2, .12, speed)}" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR}" fill="url(#skylineLuminary)"/>${background.join("")}${fabric}${water}${reflections.join("")}${foreground.join("")}${street}</g>`;
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
