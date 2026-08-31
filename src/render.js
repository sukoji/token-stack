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

function hasUnpricedCodex(stats) {
  return (stats?.byAgent ?? []).some((agent) => agent.name === "codex" && agent.total > 0);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escAttr = (s) =>
  esc(s).replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function safeDays(days) {
  const source = Array.isArray(days) ? days : [];
  if (!source.length) return [{ date: "", total: 0, cost: 0, sessions: 0, projects: 0, agents: 0 }];
  return source.map((day) => ({
    date: String(day?.date ?? ""),
    total: Number.isFinite(day?.total) && day.total > 0 ? day.total : 0,
    cost: Number.isFinite(day?.cost) && day.cost > 0 ? day.cost : 0,
    sessions: Number.isFinite(day?.sessions) && day.sessions > 0 ? Math.floor(day.sessions) : 0,
    projects: Number.isFinite(day?.projects) && day.projects > 0 ? Math.floor(day.projects) : 0,
    agents: Number.isFinite(day?.agents) && day.agents > 0 ? Math.floor(day.agents) : 0,
  }));
}

// Skyline token geometry uses only providers with locally observable token
// fields. Session/project signals remain separate and drive subtle street
// life rather than being misrepresented as building volume.
function citySignals(days, sourceDayCount) {
  const windowDays = Math.max(0, Number.isInteger(sourceDayCount) ? sourceDayCount : days.length);
  const activeDays = days.filter((day) => day.total > 0).length;
  const windowTotal = days.reduce((sum, day) => sum + day.total, 0);
  const peak = Math.max(...days.map((day) => day.total), 0);
  const recentDays = days.slice(-Math.min(7, days.length));
  const recentSessions = recentDays.reduce((sum, day) => sum + day.sessions, 0);
  const projectBreadth = Math.max(...recentDays.map((day) => day.projects), 0);
  const agentBreadth = Math.max(...recentDays.map((day) => day.agents), 0);
  const trafficLevel = recentSessions ? clamp(Math.log1p(recentSessions) / Math.log1p(18), 0, 1) : 0;
  const vehicleCount = recentSessions ? clamp(Math.round(1 + trafficLevel * 4), 1, 5) : 0;
  const pedestrianCount = projectBreadth ? clamp(projectBreadth + Math.max(0, agentBreadth - 1), 1, 5) : 0;
  let tokenStreak = 0;
  for (let index = days.length - 1; index >= 0 && days[index].total > 0; index--) tokenStreak++;

  let rhythmLabel;
  if (!windowDays) rhythmLabel = "NO TOKEN WINDOW";
  else if (!activeDays) rhythmLabel = "QUIET WINDOW";
  else if (activeDays === 1) rhythmLabel = "ONE ACTIVE DAY";
  else if (peak / Math.max(windowTotal, 1) >= .45) rhythmLabel = "BURST-LED";
  else if (activeDays / windowDays >= .65) rhythmLabel = "CONSISTENT RHYTHM";
  else rhythmLabel = "INTERMITTENT RHYTHM";

  // The selected chart window can begin in the middle of a longer run. In
  // that case the visible streak is a lower bound, not an exact duration.
  const tokenStreakReachesWindowStart = tokenStreak > 0 && tokenStreak === windowDays;
  const tokenStreakDisplay = tokenStreakReachesWindowStart ? `≥${tokenStreak}` : String(tokenStreak);
  const streakDescription = !tokenStreak
    ? "The latest day has no token activity."
    : tokenStreakReachesWindowStart
      ? `The token streak spans this entire window, so it is at least ${tokenStreak} days.`
      : `The current token streak is ${tokenStreak} days.`;
  const readout = !windowDays
    ? "DAILY TOKENS · NO TOKEN WINDOW"
    : [
      "DAILY TOKENS",
      `${activeDays}/${windowDays} ACTIVE`,
      tokenStreak ? `${tokenStreakDisplay}D STREAK` : "NO STREAK",
    ].join(" · ");
  const mobilityDescription = recentSessions || projectBreadth
    ? ` Street traffic reflects ${recentSessions} sessions in the latest ${recentDays.length} days; pedestrians reflect up to ${projectBreadth} active projects per day.`
    : "";
  const description = !windowDays
    ? "Building height represents daily tokens. Layered city density represents sustained token activity. No token days were supplied for this window."
    : !activeDays
      ? `Building height represents daily tokens. Layered city density represents sustained token activity. This ${windowDays}-day window has no token-active days.`
      : `Building height represents daily tokens. Layered city density represents sustained token activity. This ${windowDays}-day window has ${activeDays} token-active days. Its token rhythm is ${rhythmLabel.toLowerCase()}. ${streakDescription}${mobilityDescription}`;

  return {
    windowDays,
    activeDays,
    tokenStreak,
    tokenStreakDisplay,
    tokenStreakReachesWindowStart,
    rhythm: rhythmLabel.toLowerCase().replaceAll(" ", "-"),
    readout,
    description,
    recentSessions,
    projectBreadth,
    agentBreadth,
    trafficLevel,
    vehicleCount,
    pedestrianCount,
  };
}

function shortModel(id) {
  return id
    .replace(/^claude-/, "")
    .replace(/-\d{8}$/, "")
    .replace(/-(\d)-(\d)/, "-$1.$2");
}

// Shared <style>: entrance fades, bar growth, donut sweep. `speed` divides
// every duration; `anim: false` renders the final frame statically.
function styles({ anim, speed, motionPolicy = "system" }, extra = "") {
  if (!anim) return "";
  const s = (base) => (base / speed).toFixed(2) + "s";
  const reducedMotionCss = motionPolicy === "always" ? "" : `
@media (prefers-reduced-motion:reduce){*{animation-duration:.01s!important;animation-delay:0s!important}.sky-star{animation:none!important;opacity:.3!important;transform:none!important}.skyline-cloud-bank,.skyline-horizon-haze,.skyline-window-glint,.skyline-water-ripple,.skyline-weather-clouds,.skyline-weather-mist,.skyline-rain-drop,.skyline-snowflake{animation:none!important;transform:none!important}.skyline-vehicle-flow,.skyline-pedestrian-flow,.skyline-person,.skyline-person-limb{animation:none!important;transform:none!important}}`;
  return `<style>
.f{opacity:0;animation:fu ${s(0.7)} cubic-bezier(.4,0,.2,1) forwards}
@keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.bx{transform:scaleX(0);transform-box:fill-box;transform-origin:left center;animation:gx ${s(0.9)} cubic-bezier(.2,.6,.2,1) forwards}
@keyframes gx{to{transform:scaleX(1)}}
.by{transform:scaleY(0);transform-box:fill-box;transform-origin:center bottom;animation:gy ${s(0.8)} cubic-bezier(.2,.6,.2,1) forwards}
@keyframes gy{to{transform:scaleY(1)}}
${extra}
${reducedMotionCss}
</style>`;
}

const delay = (i, step, speed) => `animation-delay:${((i * step) / speed).toFixed(2)}s`;

function frame(w, h, t, title, body, style, scale = 1, description = "") {
  const accessibleLabel = description ? `${title}. ${description}` : title;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escAttr(accessibleLabel)}">
<title>${esc(title)}</title>${description ? `\n<desc>${esc(description)}</desc>` : ""}
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
      return `<rect class="f" style="${delay(i, 0.012, speed)}" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${cell}" height="${cell}" rx="2.5" ${fill}><title>${esc(d.date)}: ${formatTokens(d.total)}</title></rect>`;
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

const CINEMATIC_DAY_PHASE = { sky: ["#5f91a9", "#a8c5cc", "#d8d0bd"], luminary: "#ead797", field: "#5b7457", grass: "#a8b77d", window: "#d9e1dc", stars: false, palette: { house: ["#8b756a", "#9a8172", "#746b67", "#8c7b72", "#6f6765"], midrise: ["#66747a", "#7b7c78", "#6c7777", "#887a70", "#5d6b72"], highrise: ["#50626b", "#626c70", "#53696c", "#69676a", "#465a63"], landmark: ["#4d6876", "#52646f", "#61757b", "#586c73", "#68777b"] } };

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

function skylineMix(color, target, amount) {
  const read = (value) => {
    const normalized = String(value).replace("#", "");
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const from = read(color);
  const to = read(target);
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

const CITY_PALETTES = ["natural", "graphite", "copper", "evergreen"];
const CITY_BASES = ["waterfront", "park", "transit"];
const CITY_MOTIONS = ["auto", "off"];
const CITY_WEATHERS = ["auto", "clear", "cloudy", "mist", "rain", "snow"];
const CITY_SEASONS = ["auto", "spring", "summer", "autumn", "winter", "off"];

function resolveCityPalette(phase, preset) {
  if (!CITY_PALETTES.includes(preset)) throw new Error(`Unknown city palette "${preset}". Available: ${CITY_PALETTES.join(", ")}`);
  if (preset === "natural") return phase;
  const settings = {
    graphite: { sky: "#8995a2", skyMix: .3, building: "#4d5863", buildingMix: .48, field: "#58636a", window: "#e6edf2" },
    copper: { sky: "#c89b83", skyMix: .22, building: "#9a5942", buildingMix: .42, field: "#756448", window: "#ffd7a0" },
    evergreen: { sky: "#77989a", skyMix: .2, building: "#395f58", buildingMix: .4, field: "#365d47", window: "#d8e8be" },
  }[preset];
  const mixPalette = (palette) => Object.fromEntries(Object.entries(palette).map(([tier, colors]) => [
    tier,
    colors.map((color) => skylineMix(color, settings.building, settings.buildingMix)),
  ]));
  return {
    ...phase,
    sky: phase.sky.map((color, index) => skylineMix(color, settings.sky, settings.skyMix * (index === 2 ? .7 : 1))),
    field: skylineMix(phase.field, settings.field, .5),
    grass: skylineMix(phase.grass, settings.field, .28),
    window: skylineMix(phase.window, settings.window, .34),
    palette: mixPalette(phase.palette),
  };
}

function resolveCitySeason(value = "off", now) {
  if (!CITY_SEASONS.includes(value)) throw new Error(`Unknown city season "${value}". Available: ${CITY_SEASONS.join(", ")}`);
  if (value !== "auto") return value;
  const date = now ? new Date(now) : new Date();
  const month = (Number.isNaN(date.getTime()) ? new Date() : date).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function resolveCityWeather(value = "clear", season = "off", now) {
  if (!CITY_WEATHERS.includes(value)) throw new Error(`Unknown weather "${value}". Available: ${CITY_WEATHERS.join(", ")}`);
  if (value !== "auto") return value;
  const date = now ? new Date(now) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const seed = safeDate.getFullYear() * 372 + (safeDate.getMonth() + 1) * 31 + safeDate.getDate();
  const roll = skylineHash(seed);
  if (season === "winter" && roll < .2) return "snow";
  if (season !== "winter" && roll < .12) return "rain";
  if (roll < .25) return "mist";
  if (roll < .53) return "cloudy";
  return "clear";
}

function applyCitySeason(phase, season) {
  if (season === "off") return phase;
  const settings = {
    spring: { grass: "#91b780", field: "#6f8d65", sky: "#b7c9c7", amount: .24 },
    summer: { grass: "#739869", field: "#4f7257", sky: "#91aeb5", amount: .2 },
    autumn: { grass: "#b47b47", field: "#76583f", sky: "#bd9981", amount: .42 },
    winter: { grass: "#d4dddf", field: "#879699", sky: "#b9c8d0", amount: .5 },
  }[season];
  return {
    ...phase,
    sky: phase.sky.map((color, index) => skylineMix(color, settings.sky, settings.amount * (index === 2 ? .7 : 1))),
    grass: skylineMix(phase.grass, settings.grass, settings.amount),
    field: skylineMix(phase.field, settings.field, settings.amount * .8),
    window: season === "winter" ? skylineMix(phase.window, "#fff1c7", .16) : phase.window,
  };
}

function applyCityWeather(phase, weather) {
  const setting = {
    cloudy: ["#87939b", .18],
    mist: ["#b8c2c1", .22],
    rain: ["#526575", .3],
    snow: ["#c2ced4", .24],
  }[weather];
  if (!setting) return phase;
  const [target, amount] = setting;
  return { ...phase, sky: phase.sky.map((color) => skylineMix(color, target, amount)) };
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
      `M${left} ${base}V${top + 8}H${at(.18)}V${top + 3}H${at(.42)}V${top}H${at(.72)}V${top + 5}H${right}V${base}Z`,
      `M${left} ${base}V${top + 8}H${at(.15)}V${top + 3}H${at(.85)}V${top + 8}H${right}V${base}Z`,
      `M${left} ${base}V${top + 5}H${at(.12)}V${top}H${at(.72)}V${top + 3}H${right}V${base}Z`,
    ][shape % 5];
  }
  if (tier === "highrise") {
    return [
      `M${left} ${base}V${top + 14}H${at(.12)}V${top + 6}H${at(.28)}V${top}H${at(.74)}V${top + 7}H${at(.9)}V${top + 14}H${right}V${base}Z`,
      `M${left} ${base}V${top + 13}H${at(.15)}V${top + 5}H${at(.34)}V${top}H${at(.7)}V${top + 5}H${at(.86)}V${top + 13}H${right}V${base}Z`,
      `M${left} ${base}V${top + 12}H${at(.14)}V${top + 7}H${at(.31)}V${top + 2}H${at(.46)}V${top}H${at(.7)}V${top + 5}H${at(.86)}V${top + 12}H${right}V${base}Z`,
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

function chartSkylineContinuous(days, t, box, {
  anim,
  speed,
  sky = "auto",
  now,
  tokenStreak = 0,
  skylineStyle = "cinematic",
  cityPalette = "natural",
  cityBase = "waterfront",
  cityMotion = "auto",
  weather = "clear",
  citySeason = "off",
  preset = "default",
  mobility = {},
} = {}) {
  const { x, y, w, h } = box;
  const resolvedPhase = resolveSkyPhase(sky, now);
  if (!["cinematic", "classic"].includes(skylineStyle)) throw new Error(`Unknown skyline style "${skylineStyle}". Available: cinematic, classic`);
  if (!CITY_BASES.includes(cityBase)) throw new Error(`Unknown city base "${cityBase}". Available: ${CITY_BASES.join(", ")}`);
  if (!CITY_MOTIONS.includes(cityMotion)) throw new Error(`Unknown city motion "${cityMotion}". Available: ${CITY_MOTIONS.join(", ")}`);
  const resolvedSeason = resolveCitySeason(citySeason, now);
  const resolvedWeather = resolveCityWeather(weather, resolvedSeason, now);
  const cinematic = skylineStyle !== "classic";
  const basePhase = cinematic && resolvedPhase.name === "day"
    ? { name: resolvedPhase.name, ...CINEMATIC_DAY_PHASE }
    : resolvedPhase;
  const phase = applyCityWeather(applyCitySeason(resolveCityPalette(basePhase, cityPalette), resolvedSeason), resolvedWeather);
  const detail = w >= 390 && h >= 95;
  const boundedTokenStreak = Number.isFinite(tokenStreak)
    ? clamp(Math.floor(tokenStreak), 0, days.length)
    : 0;
  const totals = days.map((day) => day.total);
  const logTotals = totals.map((total) => total > 0 ? Math.log1p(total) : 0);
  const positiveLogs = logTotals.filter(Boolean).sort((a, b) => a - b);
  const maxDailyTotal = Math.max(...totals, 0);
  const villageScale = maxDailyTotal <= 25_000;
  const landmarkEligible = maxDailyTotal >= 500_000;
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
  const clusterCount = positiveLogs.length ? clamp(Math.round(positiveLogs.length / 10) + 1, 1, 5) : 0;
  const clusterCenters = Array.from({ length: clusterCount }, (_, cluster) => {
    const start = Math.floor(cluster * days.length / clusterCount);
    const end = Math.max(start + 1, Math.floor((cluster + 1) * days.length / clusterCount));
    let center = start;
    let best = -1;
    for (let index = start; index < Math.min(end, days.length); index++) {
      const score = heightScore[index] * .7 + densityScore[index] * .3;
      if (score > best) {
        best = score;
        center = index;
      }
    }
    return { center, strength: .58 + Math.max(0, best) * .42 };
  });
  const clusterRadius = Math.max(1.5, days.length / Math.max(2, clusterCount * 1.35));
  const clusterAt = (position) => clusterCenters.reduce((peak, cluster) => {
    const distance = Math.abs(position - cluster.center) / clusterRadius;
    return Math.max(peak, cluster.strength * Math.max(0, 1 - distance) ** 1.35);
  }, 0);
  const nightscape = phase.name === "night" || phase.name === "dusk";
  // Every cinematic base reserves the same foreground depth so changing the
  // environment does not unexpectedly stretch or shrink the skyline.
  const sceneDepth = cinematic
    ? (detail ? Math.max(25, Math.round(h * .22)) : Math.max(12, Math.round(h * .18)))
    : nightscape ? (detail ? 15 : 9) : 0;
  const waterDepth = cityBase === "waterfront" ? sceneDepth : 0;
  const groundDepth = cinematic ? sceneDepth : (waterDepth || (detail ? 7 : 5));
  const base = y + h - groundDepth;
  const cityCeiling = Math.max(detail ? 44 : 27, base - y - 5);
  const lots = clamp(
    Math.round(days.length * (detail ? 1.08 : 1.2)),
    detail ? 18 : 18,
    detail ? 48 : 30,
  );
  const lotWidth = w / lots;
  const backgroundLots = Math.max(20, Math.round(lots * 0.72));
  const defs = [`<clipPath id="skylineScene"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/></clipPath>`];
  const farBackground = [];
  const background = [];
  const districtLayers = [[], []];
  const fabricPoints = [];
  const foreground = [];
  const reflections = [];
  let buildingIndex = 0;

  const addBuilding = ({ id, tier, shape, left, width, height, color, opacity = 1, label, delayIndex, score = 0, density = 0, cluster = 0 }) => {
    const architecture = cinematic
      ? (() => {
        const seed = skylineHash((delayIndex + 11) * 79 + shape * 31);
        const choices = tier === "house"
          ? ["masonry", "residential", "masonry", "civic"]
          : tier === "midrise"
            ? cluster > .62
              ? ["office", "residential", "masonry", "glass"]
              : ["masonry", "residential", "office", "civic"]
            : tier === "highrise"
              ? cluster > .58
                ? ["glass", "office", "glass", "residential"]
                : ["office", "residential", "glass", "masonry"]
              : ["glass", "civic", "office", "glass"];
        return choices[Math.min(choices.length - 1, Math.floor(seed * choices.length))];
      })()
      : "classic";
    const roofProfiles = {
      masonry: [0, 3, 4],
      residential: [1, 3, 4],
      office: [0, 1, 2, 3],
      glass: [1, 2, 3, 4],
      civic: [0, 3],
    };
    const roofProfile = roofProfiles[architecture];
    const architecturalShape = cinematic && tier !== "house" && tier !== "landmark" && roofProfile
      ? roofProfile[(shape + delayIndex) % roofProfile.length]
      : shape;
    const path = skylineShape(tier, architecturalShape, left, width, base, height);
    const clipId = `skylineClip${id}`;
    const top = base - height;
    // One stage owns both the silhouette and all facade detail. Growing only
    // the path leaves its windows suspended at their final coordinates while
    // the building is still short. The outer SVG clip locks every detail to
    // the exact silhouette; the inner CSS clip reveals that whole stage from
    // the street upward without vertically stretching window rectangles.
    const stageClass = "skyline-building-grow";
    const stageStyle = anim ? ` style="${delay(delayIndex, .025, speed)}"` : "";
    defs.push(`<clipPath id="${clipId}"><path d="${path}"/></clipPath>`);
    const materialId = `skylineMaterial${id}`;
    const materialHighlight = skylineMix(color, "#ffffff", phase.name === "day" ? .36 : .18);
    const materialShadow = skylineMix(color, "#06101d", phase.name === "night" ? .58 : .5);
    if (cinematic && detail) {
      defs.push(`<linearGradient id="${materialId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${materialHighlight}"/><stop offset=".34" stop-color="${color}"/><stop offset=".78" stop-color="${skylineMix(color, materialShadow, .55)}"/><stop offset="1" stop-color="${materialShadow}"/></linearGradient>`);
    }
    const buildingFill = cinematic && detail ? `url(#${materialId})` : color;
    const facadeWidth = Math.max(1, width * (tier === "landmark" ? .28 : cinematic ? .24 : .18));
    const face = `<rect x="${(left + width - facadeWidth).toFixed(1)}" y="${top.toFixed(1)}" width="${facadeWidth.toFixed(1)}" height="${height.toFixed(1)}" fill="${cinematic ? materialShadow : "#101827"}" fill-opacity="${cinematic ? (phase.name === "day" ? ".42" : ".46") : (phase.name === "day" ? ".12" : ".24")}"/>`;
    const facadeLineLimit = architecture === "glass" ? 5 : architecture === "office" ? 4 : architecture === "civic" ? 3 : 2;
    const facadeLineCount = clamp(Math.floor(width / (architecture === "glass" ? 5.5 : 8)), 1, facadeLineLimit);
    const facadeLines = detail && tier !== "house" && width >= 9
      ? Array.from({ length: facadeLineCount }, (_, line) => {
        const lx = left + width * ((line + 1) / (facadeLineCount + 1));
        return `<path d="M${lx.toFixed(1)} ${(top + 3).toFixed(1)}V${(base - 2).toFixed(1)}" stroke="${cinematic ? materialHighlight : "#122231"}" stroke-opacity="${cinematic ? (tier === "landmark" ? (phase.name === "day" ? ".16" : ".23") : (phase.name === "day" ? ".09" : ".14")) : (tier === "landmark" ? ".25" : ".17")}" stroke-width=".65"/>`;
      }).join("")
      : "";
    const facadeBands = cinematic && detail && tier !== "house" && height >= 24
      ? Array.from({ length: clamp(Math.floor(height / 14), 1, 7) }, (_, band) => {
        const bandY = top + 8 + band * Math.max(8, (height - 12) / clamp(Math.floor(height / 14), 1, 7));
        return `<path d="M${(left + 1).toFixed(1)} ${bandY.toFixed(1)}H${(left + width - 1).toFixed(1)}" stroke="${materialShadow}" stroke-opacity="${phase.name === "day" ? ".17" : ".2"}" stroke-width=".55"/>`;
      }).join("")
      : "";
    const edgeLight = cinematic
      ? `<path class="skyline-edge-light" d="M${(left + 1).toFixed(1)} ${(top + 3).toFixed(1)}V${(base - 2).toFixed(1)}" stroke="${materialHighlight}" stroke-opacity="${phase.name === "night" ? ".38" : ".28"}" stroke-width=".65"/>`
      : "";
    const silhouetteRim = cinematic && detail
      ? `<path class="skyline-silhouette-rim" d="${path}" fill="none" stroke="${materialHighlight}" stroke-opacity="${phase.name === "day" ? ".24" : ".16"}" stroke-width=".55"/>`
      : "";
    const glassSheen = cinematic && detail && tier !== "house" && width >= 8 && (architecture === "glass" || architecture === "office")
      ? `<path class="skyline-glass-sheen" d="M${(left + width * .12).toFixed(1)} ${base}L${(left + width * .46).toFixed(1)} ${top.toFixed(1)}H${(left + width * .67).toFixed(1)}L${(left + width * .38).toFixed(1)} ${base}Z" fill="#ffffff" fill-opacity="${phase.name === "day" ? ".075" : ".035"}"/>`
      : "";
    const architectureDetail = cinematic && detail
      ? (() => {
        if (architecture === "masonry") {
          return `<g class="skyline-architecture skyline-facade-masonry"><path d="M${left.toFixed(1)} ${(top + 5).toFixed(1)}H${(left + width).toFixed(1)}M${left.toFixed(1)} ${(base - 5).toFixed(1)}H${(left + width).toFixed(1)}" stroke="${materialHighlight}" stroke-opacity=".24" stroke-width="1"/></g>`;
        }
        if (architecture === "residential" && tier !== "house") {
          const balconyCount = clamp(Math.floor(height / 17), 1, 5);
          return `<g class="skyline-architecture skyline-facade-residential">${Array.from({ length: balconyCount }, (_, index) => { const balconyY = top + 10 + index * Math.max(10, (height - 15) / balconyCount); return `<path d="M${(left + width * .08).toFixed(1)} ${balconyY.toFixed(1)}H${(left + width * .92).toFixed(1)}" stroke="${materialHighlight}" stroke-opacity=".3" stroke-width="1.15"/>`; }).join("")}</g>`;
        }
        if (architecture === "office") {
          return `<g class="skyline-architecture skyline-facade-office"><rect x="${(left + 1).toFixed(1)}" y="${(top + Math.min(12, height * .24)).toFixed(1)}" width="${Math.max(1, width - 2).toFixed(1)}" height="2.2" fill="${materialShadow}" fill-opacity=".42"/></g>`;
        }
        if (architecture === "civic") {
          return `<g class="skyline-architecture skyline-facade-civic"><path d="M${left.toFixed(1)} ${(top + 4).toFixed(1)}H${(left + width).toFixed(1)}M${(left + width * .28).toFixed(1)} ${(top + 6).toFixed(1)}V${(base - 3).toFixed(1)}M${(left + width * .72).toFixed(1)} ${(top + 6).toFixed(1)}V${(base - 3).toFixed(1)}" stroke="${materialHighlight}" stroke-opacity=".25" stroke-width="1"/></g>`;
        }
        return `<g class="skyline-architecture skyline-facade-glass"><path d="M${(left + width * .5).toFixed(1)} ${(top + 2).toFixed(1)}V${(base - 2).toFixed(1)}" stroke="#ffffff" stroke-opacity=".12" stroke-width=".75"/></g>`;
      })()
      : "";
    const towerPodium = cinematic && detail && tier === "highrise"
      ? `<g class="skyline-tower-podium"><rect x="${(left - width * .08).toFixed(1)}" y="${(base - 6).toFixed(1)}" width="${(width * 1.16).toFixed(1)}" height="6" rx=".5" fill="${materialShadow}" fill-opacity=".96"/><path d="M${left.toFixed(1)} ${(base - 4).toFixed(1)}H${(left + width).toFixed(1)}" stroke="${phase.window}" stroke-opacity="${phase.name === "day" ? ".26" : ".5"}" stroke-width=".65"/></g>`
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
          : cinematic && phase.name === "day" ? .34 : .58;
      const brightFloor = Math.floor(skylineHash((delayIndex + 13) * 43) * rows);
      windows = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
        const wx = left + width * .14 + ((width * .72) * (col + .5) / cols);
        const wy = startY + row * gap;
        const seed = skylineHash((delayIndex + 1) * 97 + row * 11 + col * 23);
        const on = seed < litProbability || (row === brightFloor && seed < litProbability + .22);
        const coolSeed = skylineHash((delayIndex + 5) * 71 + row * 17 + col * 29);
        const cool = (phase.name === "night" && coolSeed > .72) || (cinematic && phase.name === "day" && coolSeed > .82);
        const fill = cool ? (phase.name === "day" ? "#c6d5d6" : "#9ed8ff") : phase.window;
        const glintSeed = skylineHash((delayIndex + 19) * 131 + row * 37 + col * 61);
        const glints = anim && nightscape && on && glintSeed > .9;
        const windowClass = `${cool ? "skyline-window skyline-window-cool" : "skyline-window skyline-window-warm"}${glints ? " skyline-window-glint" : ""}`;
        const windowStyle = glints
          ? ` style="animation-delay:${((2.4 + glintSeed * 4.2) / speed).toFixed(2)}s;animation-duration:${((7.5 + glintSeed * 5.5) / speed).toFixed(2)}s"`
          : "";
        const windowOpacity = on
          ? (phase.name === "night" ? .9 : cinematic && phase.name === "day" ? .34 : .58)
          : (cinematic && phase.name === "day" ? .035 : .1);
        return `<rect class="${windowClass}"${windowStyle} x="${(wx - .8).toFixed(1)}" y="${wy.toFixed(1)}" width="1.6" height="${tier === "landmark" ? "2" : "2.4"}" rx=".4" fill="${fill}" fill-opacity="${windowOpacity}"/>`;
      }).join("")).join("");
      if (phase.name === "night" && tier === "landmark") {
        crownBand = `<rect class="skyline-crown-band" x="${(left + width * .23).toFixed(1)}" y="${(top + landmarkMetrics.lightBand).toFixed(1)}" width="${(width * .54).toFixed(1)}" height="1.1" fill="#9ed8ff" fill-opacity=".72"/>`;
      }
    } else if (width >= 3.5) {
      windows = `<path d="M${(left + width * .5).toFixed(1)} ${top + 4}V${base - 3}" stroke="${phase.window}" stroke-opacity=".35" stroke-width=".7"/>`;
    }
    foreground.push(`<g class="skyline-${tier}" data-height="${height.toFixed(1)}" data-width="${width.toFixed(1)}" data-score="${score.toFixed(3)}" data-density="${density.toFixed(3)}" data-cluster="${cluster.toFixed(3)}" data-architecture="${architecture}"><title>${esc(label)}</title><g class="skyline-building-stage" data-building-id="${id}" clip-path="url(#${clipId})"><g class="${stageClass}"${stageStyle}><path class="skyline-building skyline-${tier}-${architecturalShape % 5}" d="${path}" fill="${buildingFill}" fill-opacity="${opacity}"/>${silhouetteRim}<g class="skyline-facade">${face}${glassSheen}${facadeLines}${facadeBands}${architectureDetail}${edgeLight}${crownBand}<g class="skyline-window-grid" data-build-order="bottom-up">${windows}</g></g></g></g>${towerPodium}</g>`);
    if (waterDepth && tier !== "house" && density > .04) {
      const reflectionHeight = cinematic
        ? Math.min(waterDepth - 3, Math.max(5, height * (tier === "landmark" ? .58 : tier === "highrise" ? .48 : .34) * (.72 + density * .28)))
        : Math.min(waterDepth - 3, Math.max(2, height * (tier === "landmark" ? .18 : tier === "highrise" ? .13 : .09)));
      const segments = cinematic
        ? detail ? clamp(Math.round(reflectionHeight / 4), 3, 6) : clamp(Math.round(reflectionHeight / 4), 2, 4)
        : tier === "landmark" || tier === "highrise" ? 3 : 2;
      for (let segment = 0; segment < segments; segment++) {
        const progress = segment / Math.max(1, segments - 1);
        const reflectionWidth = Math.max(1.6, width * (.74 - progress * .42));
        const reflectionX = left + (width - reflectionWidth) / 2 + (skylineHash(delayIndex * 53 + segment) - .5) * 2;
        const reflectionY = base + 2 + progress * reflectionHeight + (segment ? .7 : 0);
        if (cinematic) {
          const skew = (skylineHash(delayIndex * 71 + segment * 17) - .5) * 2.4;
          const tailWidth = Math.max(1.1, reflectionWidth * (.58 - progress * .16));
          reflections.push(`<path class="skyline-reflection skyline-reflection-shard" data-building-reflection="${id}" data-segment="${segment + 1}" d="M${reflectionX.toFixed(1)} ${reflectionY.toFixed(1)}h${reflectionWidth.toFixed(1)}l${skew.toFixed(1)} ${(segment === 0 ? 1.2 : .72).toFixed(2)}h-${tailWidth.toFixed(1)}Z" fill="${skylineMix(color, phase.window, tier === "landmark" ? .22 : .1)}" fill-opacity="${tier === "landmark" ? ".38" : ".24"}"/>`);
        } else {
          reflections.push(`<rect class="skyline-reflection" x="${reflectionX.toFixed(1)}" y="${reflectionY.toFixed(1)}" width="${reflectionWidth.toFixed(1)}" height="${segment === 0 ? "1.1" : ".75"}" rx=".5" fill="${color}" fill-opacity="${tier === "landmark" ? ".36" : ".22"}"/>`);
        }
      }
      if (tier === "landmark" || tier === "highrise") {
        const glowWidth = Math.max(2, width * .42);
        reflections.push(`<rect class="skyline-reflection skyline-reflection-light" x="${(left + (width - glowWidth) / 2).toFixed(1)}" y="${(base + 3).toFixed(1)}" width="${glowWidth.toFixed(1)}" height=".8" rx=".4" fill="${phase.window}" fill-opacity=".34"/>`);
      }
    }
  };

  if (cinematic) {
    const farLots = Math.max(16, Math.round(backgroundLots * .78));
    for (let i = 0; i < farLots; i++) {
      const position = (i + .5) * (days.length - 1) / farLots;
      const density = skylineSample(densityScore, position);
      const cluster = clusterAt(position);
      const farWidth = w / farLots + 1.2;
      const farLeft = x + i * (w / farLots) - .6;
      const farHeight = 3.5 + cityScale * 4 + density * (detail ? 8 : 5) * (.62 + cluster * .38) + cluster * 2.2 + skylineHash(i * 29 + 5) * 2.8;
      const roofInset = skylineHash(i * 31 + 7) > .7 ? farWidth * .22 : 0;
      farBackground.push(`<path class="skyline-far-building" d="M${farLeft.toFixed(1)} ${base}V${(base - farHeight + roofInset).toFixed(1)}L${(farLeft + roofInset).toFixed(1)} ${(base - farHeight).toFixed(1)}H${(farLeft + farWidth).toFixed(1)}V${base}Z" fill="url(#skylineFarFacade)" fill-opacity="${(.18 + density * .1).toFixed(2)}"/>`);
    }
  }

  if (cinematic) {
    const layerSpecs = detail
      ? [
        { name: "rear", count: clamp(Math.round(lots * .68), 22, 28), baseOffset: 5, minHeight: 7, heightScale: 27, opacity: .4 },
        { name: "middle", count: clamp(Math.round(lots * .86), 28, 36), baseOffset: 2, minHeight: 10, heightScale: 38, opacity: .66 },
      ]
      : [
        { name: "rear", count: 11, baseOffset: 4, minHeight: 6, heightScale: 17, opacity: .45 },
        { name: "middle", count: 14, baseOffset: 1.5, minHeight: 8, heightScale: 22, opacity: .7 },
      ];
    for (const [depth, spec] of layerSpecs.entries()) {
      const laneWidth = w / spec.count;
      for (let i = 0; i < spec.count; i++) {
        const position = clamp((i + .5 + (depth ? .18 : -.14)) * (days.length - 1) / spec.count, 0, days.length - 1);
        const density = skylineSample(densityScore, position);
        const cluster = clusterAt(position);
        const nearbyHeight = Math.max(
          skylineSample(heightScore, clamp(position - 1.35, 0, days.length - 1)),
          skylineSample(heightScore, position),
          skylineSample(heightScore, clamp(position + 1.35, 0, days.length - 1)),
        );
        const seed = skylineHash((depth + 3) * 1009 + i * 47);
        if (density < .025 && nearbyHeight < .04 && (!positiveLogs.length || seed > .35)) continue;
        const layerBase = base - spec.baseOffset;
        const height = Math.min(
          cityCeiling * (depth ? .74 : .56),
          spec.minHeight + cityScale * (depth ? 9 : 6) + nearbyHeight * spec.heightScale * (.62 + cluster * .38) + density * 5 + cluster * (depth ? 6 : 4) + seed * (depth ? 7 : 5),
        );
        const tier = !villageScale && height > cityCeiling * (depth ? .52 : .44) && seed > .66 ? "highrise" : "midrise";
        const shape = Math.floor(skylineHash(i * 73 + depth * 211 + 17) * 5);
        const width = Math.min(detail ? 25 : 18, laneWidth * (.78 + cluster * .12 + skylineHash(i * 89 + depth * 307) * .54));
        const jitter = (skylineHash(i * 109 + depth * 401) - .5) * laneWidth * .72;
        const left = clamp(x + i * laneWidth + jitter - width * .26, x - 2, x + w - width + 2);
        const color = phase.palette[tier][(shape + i + depth) % phase.palette[tier].length];
        const atmosphericColor = skylineMix(color, phase.sky[depth ? 0 : 1], depth ? .24 : .5);
        const path = skylineShape(tier, shape, left, width, layerBase, height);
        const shaftCount = detail && width >= 7 ? clamp(Math.floor(width / (depth ? 5.5 : 7)), 1, depth ? 4 : 2) : 1;
        const lightShafts = Array.from({ length: shaftCount }, (_, shaft) => {
          const shaftX = left + width * ((shaft + 1) / (shaftCount + 1));
          return `<path d="M${shaftX.toFixed(1)} ${(layerBase - height + Math.min(9, height * .28)).toFixed(1)}V${(layerBase - 3).toFixed(1)}" stroke="${phase.window}" stroke-opacity="${phase.name === "day" ? (depth ? ".09" : ".04") : (depth ? ".24" : ".11")}" stroke-width="${depth ? ".75" : ".5"}" stroke-dasharray="1.4 4.5"/>`;
        }).join("");
        const sideWidth = width * (.18 + seed * .12);
        const sideFace = `<path class="skyline-district-side" d="M${(left + width - sideWidth).toFixed(1)} ${(layerBase - height + 2).toFixed(1)}H${(left + width).toFixed(1)}V${layerBase}H${(left + width - sideWidth).toFixed(1)}Z" fill="#06121d" fill-opacity="${depth ? ".28" : ".18"}"/>`;
        const roofLine = `<path d="M${(left + width * .08).toFixed(1)} ${(layerBase - height + Math.min(7, height * .16)).toFixed(1)}H${(left + width * .92).toFixed(1)}" stroke="${skylineMix(atmosphericColor, "#ffffff", .44)}" stroke-opacity="${depth ? ".24" : ".14"}" stroke-width=".55"/>`;
        districtLayers[depth].push(`<g class="skyline-district-building skyline-district-${spec.name}" data-depth="${depth + 1}" data-score="${nearbyHeight.toFixed(3)}" data-cluster="${cluster.toFixed(3)}"><path d="${path}" fill="${atmosphericColor}" fill-opacity="${spec.opacity}" stroke="${skylineMix(atmosphericColor, "#ffffff", .28)}" stroke-opacity="${depth ? ".2" : ".12"}" stroke-width=".45"/>${sideFace}${roofLine}${lightShafts}</g>`);
      }
    }
  } else {
    for (let i = 0; i < backgroundLots; i++) {
      const position = (i + .5) * (days.length - 1) / backgroundLots;
      const density = skylineSample(densityScore, position);
      const height = 5 + cityScale * (detail ? 5 : 3) + density * (detail ? 12 : 9) + skylineHash(i + 31) * 3;
      const left = x + i * (w / backgroundLots) - .4;
      const width = w / backgroundLots + .9;
      const color = phase.palette.midrise[i % phase.palette.midrise.length];
      background.push(`<rect class="skyline-background-building" x="${left.toFixed(1)}" y="${(base - height).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${color}" fill-opacity=".26"/>`);
    }
  }

  for (let i = 0; i <= days.length; i++) {
    const density = skylineSample(densityScore, clamp(i, 0, days.length - 1));
    const cluster = clusterAt(clamp(i, 0, days.length - 1));
    fabricPoints.push(`${(x + (i / days.length) * w).toFixed(1)},${(base - 3 - density * (7 + cityScale * 7) * (.76 + cluster * .24)).toFixed(1)}`);
  }

  for (let i = 0; i < lots; i++) {
    const position = (i + .5) * (days.length - 1) / lots;
    const density = skylineSample(densityScore, position);
    const heightValue = skylineSample(heightScore, position);
    const cluster = clusterAt(position);
    const dayIndex = clamp(Math.round(position), 0, days.length - 1);
    const width = Math.min(detail ? 50 : 32, lotWidth * (.88 + skylineHash(i * 13 + dayIndex * 31) * .32) + .55);
    const left = x + i * lotWidth - (width - lotWidth) * .38 - .3;
    const shape = Math.floor(skylineHash(i * 17 + dayIndex * 5) * 5);
    const idle = density < .075 && totals[dayIndex] === 0;
    if (idle) {
      const treeHeight = 4 + skylineHash(i + 91) * 6;
      const treeRadius = Math.min(detail ? 5.5 : 3.5, Math.max(1.3, width * .18));
      foreground.push(`<g class="skyline-field"><path d="M${left.toFixed(1)} ${base}V${(base - 3).toFixed(1)}q${(width / 2).toFixed(1)} -2 ${width.toFixed(1)} 0V${base}Z" fill="${phase.field}"/><circle cx="${(left + width * .5).toFixed(1)}" cy="${(base - treeHeight).toFixed(1)}" r="${treeRadius.toFixed(1)}" fill="${phase.grass}" fill-opacity=".9"/><path d="M${(left + width * .5).toFixed(1)} ${base - 2}v${-(treeHeight - 2)}" stroke="#384c38" stroke-width=".8"/></g>`);
      continue;
    }
    const supportsHighrise = !villageScale && heightValue > .56 && density > .48 && (localPeakScore[dayIndex] > .25 || skylineHash(i * 47 + dayIndex * 19) > .78);
    // Relative lows in a billion-token profile are still part of a downtown;
    // reserve detached homes for genuinely smaller overall activity scales.
    const houseThreshold = .16 * (1 - cityScale);
    const tier = villageScale ? "house" : heightValue < houseThreshold ? "house" : supportsHighrise ? "highrise" : "midrise";
    const computedHeight = tier === "house"
      ? 7 + cityScale * 4 + heightValue * 11
      : tier === "highrise"
        ? 42 + cityScale * 10 + (clamp((heightValue - .56) / .44, 0, 1) ** .85) * 25
        : 13 + cityScale * 9 + (clamp((heightValue - .16) / .6, 0, 1) ** 1.12) * 36;
    const heightCap = tier === "house"
      ? Math.min(h * .3, cityCeiling * .28)
      : tier === "highrise"
        ? Math.min(h * (detail ? .72 : .66), cityCeiling * .96)
        : Math.min(h * (detail ? .56 : .48), cityCeiling * .76);
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
      cluster,
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
    if (landmarkEligible && value > .5 && value > previous + .005 && value > next + .005 && prominence > .075) {
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
  if (landmarkEligible && !peaks.length && rawRange > .35 && rawMax > .55) {
    const value = rawMax;
    peaks.push({ index: raw.indexOf(value), value, prominence: value });
  }
  const citySignature = days.reduce((signature, day, index) => {
    const numericDate = Number(String(day.date ?? "").replaceAll("-", "")) || index;
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
    const landmarkMinHeight = detail ? 46 : 28;
    const landmarkMaxHeight = Math.max(landmarkMinHeight, Math.min(h * .78, cityCeiling * .98));
    const height = clamp(h * (.39 + cityScale * .16 + heightScore[index] * .24 + prominence * .25), landmarkMinHeight, landmarkMaxHeight);
    const desiredWidth = Math.max(detail ? 12 : 8.5, baseWidth * [.56, .62, .58, .6, .64][shape]);
    const width = Math.min(desiredWidth, height / (detail ? 4 : 3));
    const centerX = x + (index + .5) * dayWidth;
    const left = clamp(centerX - width / 2, x, x + w - width);
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
      cluster: clusterAt(index),
    });
  }

  const starCycle = Math.max(6, 10 / speed);
  const stars = phase.stars ? Array.from({ length: cinematic ? (detail ? 30 : 14) : (detail ? 20 : 10) }, (_, i) => {
    const sx = x + 12 + skylineHash(i * 67 + 19) * Math.max(20, w - 24);
    const sy = y + 9 + skylineHash(i * 83 + 41) * Math.max(12, Math.floor(h * .38));
    const radius = skylineHash(i * 101 + 7) > .72 ? 1.2 : .72;
    // Start each star at a deterministic point in a slow opacity cycle. A
    // negative delay prevents a left-to-right "star run" on first paint.
    const phaseDelay = -skylineHash(i * 149 + 53) * starCycle;
    const starStyle = anim ? ` style="animation-delay:${phaseDelay.toFixed(2)}s"` : "";
    return `<circle class="sky-star"${starStyle} cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${radius}" fill="${phase.window}"/>`;
  }).join("") : "";
  const cloudOpacity = phase.name === "day" ? (cinematic ? ".085" : ".2") : (cinematic ? ".18" : ".16");
  const clouds = phase.name === "day" || phase.name === "dawn" ? `<g class="f skyline-cloud-bank" style="${delay(1, .1, speed)}" fill="${cinematic ? "url(#skylineCloud)" : "#ffffff"}" fill-opacity="${cloudOpacity}"><path d="M${(x + w * .08).toFixed(1)} ${(y + h * .25).toFixed(1)}c${(w * .022).toFixed(1)} -${(h * .09).toFixed(1)} ${(w * .065).toFixed(1)} -${(h * .09).toFixed(1)} ${(w * .084).toFixed(1)} 0c${(w * .022).toFixed(1)} -${(h * .055).toFixed(1)} ${(w * .072).toFixed(1)} -${(h * .045).toFixed(1)} ${(w * .084).toFixed(1)} ${(h * .035).toFixed(1)}H${(x + w * .26).toFixed(1)}c-${(w * .018).toFixed(1)} ${(h * .055).toFixed(1)} -${(w * .14).toFixed(1)} ${(h * .055).toFixed(1)} -${(w * .18).toFixed(1)} 0Z"/><path d="M${(x + w * .63).toFixed(1)} ${(y + h * .34).toFixed(1)}c${(w * .018).toFixed(1)} -${(h * .07).toFixed(1)} ${(w * .055).toFixed(1)} -${(h * .065).toFixed(1)} ${(w * .07).toFixed(1)} 0c${(w * .022).toFixed(1)} -${(h * .05).toFixed(1)} ${(w * .06).toFixed(1)} -${(h * .035).toFixed(1)} ${(w * .075).toFixed(1)} ${(h * .025).toFixed(1)}H${(x + w * .8).toFixed(1)}c-${(w * .014).toFixed(1)} ${(h * .045).toFixed(1)} -${(w * .12).toFixed(1)} ${(h * .045).toFixed(1)} -${(w * .17).toFixed(1)} 0Z"/>${cinematic ? `<path d="M${(x + w * .35).toFixed(1)} ${(y + h * .14).toFixed(1)}c${(w * .035).toFixed(1)} -${(h * .055).toFixed(1)} ${(w * .1).toFixed(1)} -${(h * .045).toFixed(1)} ${(w * .13).toFixed(1)} 0h${(w * .11).toFixed(1)}c-${(w * .03).toFixed(1)} ${(h * .04).toFixed(1)} -${(w * .17).toFixed(1)} ${(h * .045).toFixed(1)} -${(w * .24).toFixed(1)} 0Z" fill-opacity=".34"/>` : ""}</g>` : "";
  const weatherClouds = ["cloudy", "rain", "snow"].includes(resolvedWeather)
    ? `<g class="skyline-weather-clouds" fill="url(#skylineCloud)" fill-opacity="${resolvedWeather === "rain" ? ".16" : ".11"}"><title>Decorative ${resolvedWeather} atmosphere; not a usage metric.</title><path d="M${x - 12} ${y + h * .14}C${x + w * .1} ${y + h * .07} ${x + w * .2} ${y + h * .15} ${x + w * .31} ${y + h * .11}S${x + w * .55} ${y + h * .08} ${x + w * .69} ${y + h * .14}S${x + w * .92} ${y + h * .08} ${x + w + 12} ${y + h * .14}V${y - 2}H${x - 12}Z"/></g>`
    : "";
  const weatherMist = resolvedWeather === "mist"
    ? `<g class="skyline-weather-mist"><title>Decorative mist atmosphere; not a usage metric.</title><path d="M${x - 18} ${base - h * .2}Q${x + w * .22} ${base - h * .27} ${x + w * .46} ${base - h * .18}T${x + w + 18} ${base - h * .22}" fill="none" stroke="#eef3f1" stroke-opacity=".1" stroke-width="${detail ? "7" : "4"}"/><path d="M${x - 12} ${base - h * .07}Q${x + w * .3} ${base - h * .12} ${x + w * .58} ${base - h * .055}T${x + w + 14} ${base - h * .09}" fill="none" stroke="#f5f6f2" stroke-opacity=".08" stroke-width="${detail ? "4.5" : "3"}"/></g>`
    : "";
  const rainDrops = resolvedWeather === "rain" ? Array.from({ length: detail ? 22 : 12 }, (_, index) => {
    const dropX = x + skylineHash(index * 71 + 19) * w;
    const dropY = y - 18 + skylineHash(index * 97 + 37) * h;
    const dropLength = 3.5 + skylineHash(index * 43 + 11) * 3.5;
    const style = anim ? ` style="animation-delay:${(-skylineHash(index * 109 + 7) * 2.4 / speed).toFixed(2)}s;animation-duration:${((1.45 + skylineHash(index * 59 + 13) * .85) / speed).toFixed(2)}s"` : "";
    return `<path class="skyline-rain-drop"${style} d="M${dropX.toFixed(1)} ${dropY.toFixed(1)}l-${(dropLength * .38).toFixed(1)} ${dropLength.toFixed(1)}" stroke="#d9e9ef" stroke-opacity=".34" stroke-width=".55" stroke-linecap="round"/>`;
  }).join("") : "";
  const snowflakes = resolvedWeather === "snow" ? Array.from({ length: detail ? 20 : 11 }, (_, index) => {
    const flakeX = x + skylineHash(index * 83 + 29) * w;
    const flakeY = y - 12 + skylineHash(index * 101 + 17) * h;
    const radius = .45 + skylineHash(index * 47 + 31) * .7;
    const style = anim ? ` style="animation-delay:${(-skylineHash(index * 127 + 5) * 6 / speed).toFixed(2)}s;animation-duration:${((5.5 + skylineHash(index * 67 + 23) * 4) / speed).toFixed(2)}s"` : "";
    return `<circle class="skyline-snowflake"${style} cx="${flakeX.toFixed(1)}" cy="${flakeY.toFixed(1)}" r="${radius.toFixed(2)}" fill="#f5f8f7" fill-opacity=".62"/>`;
  }).join("") : "";
  const weatherBack = weatherClouds + weatherMist;
  const weatherFront = rainDrops || snowflakes ? `<g class="skyline-weather-foreground"><title>Decorative ${resolvedWeather} atmosphere; not a usage metric.</title>${rainDrops}${snowflakes}</g>` : "";
  const fabric = `<polygon class="skyline-fabric" points="${x},${base} ${fabricPoints.join(" ")} ${x + w},${base}" fill="${phase.palette.midrise[0]}" fill-opacity=".42"/>`;
  const waterColors = phase.name === "night"
    ? ["#0a1828", "#12314d"]
    : phase.name === "dusk"
      ? ["#413f55", "#1d3448"]
      : phase.name === "dawn"
        ? ["#718b9e", "#31485c"]
        : ["#6d9aaa", "#2b465b"];
  const water = waterDepth ? `<g class="skyline-water"><rect x="${x}" y="${base + 1}" width="${w}" height="${y + h - base - 1}" fill="url(#skylineWater)"/><path d="M${x} ${base + 2}H${x + w}" stroke="${phase.window}" stroke-opacity="${cinematic ? ".32" : ".2"}" stroke-width=".7"/>${Array.from({ length: cinematic ? (detail ? 8 : 4) : (detail ? 3 : 2) }, (_, i) => { const waveY = base + 4 + i * (detail ? 3.4 : 2.5); const waveX = x + skylineHash(i * 79 + 17) * w * .22; const waveWidth = w * (.18 + skylineHash(i * 43 + 29) * .48); const rippleSeed = skylineHash(i * 113 + 47); const rippleStyle = anim && cinematic ? ` style="animation-delay:${(-rippleSeed * 9 / speed).toFixed(2)}s;animation-duration:${((13 + rippleSeed * 8) / speed).toFixed(2)}s"` : ""; return `<path class="skyline-water-ripple"${rippleStyle} d="M${waveX.toFixed(1)} ${waveY.toFixed(1)}q${(waveWidth * .25).toFixed(1)} ${((i % 2 ? -1 : 1) * .45).toFixed(1)} ${(waveWidth * .5).toFixed(1)} 0t${(waveWidth * .5).toFixed(1)} 0" stroke="${phase.window}" stroke-opacity="${i === 0 ? (cinematic ? ".2" : ".12") : (cinematic ? ".09" : ".08")}" stroke-width=".55" fill="none"/>`; }).join("")}</g>` : "";
  const luminaryX = x + w - (detail ? 30 : 20);
  const luminaryY = y + (detail ? 24 : 17);
  const luminaryR = detail ? (phase.name === "day" ? 5.3 : 11) : (phase.name === "day" ? 4 : 7);
  const moonHalo = phase.name === "night" ? `<circle class="skyline-moon-halo" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR * (cinematic ? 3.1 : 2.35)}" fill="#d8e9ff" fill-opacity="${cinematic ? ".035" : ".055"}"/><circle class="skyline-moon-halo" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR * (cinematic ? 2.05 : 1.55)}" fill="#d8e9ff" fill-opacity="${cinematic ? ".075" : ".07"}"/>` : "";
  const luminaryGlow = cinematic ? `<circle class="skyline-luminary-glow" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR * (phase.name === "night" ? 3.5 : 4.6)}" fill="url(#skylineLuminaryGlow)"/>` : "";
  const atmosphericDust = cinematic ? Array.from({ length: detail ? 22 : 10 }, (_, index) => {
    const dustX = x + skylineHash(index * 107 + 37) * w;
    const dustY = y + h * .18 + skylineHash(index * 131 + 23) * h * .52;
    const dustR = .25 + skylineHash(index * 61 + 13) * .55;
    return `<circle class="skyline-atmosphere-particle" cx="${dustX.toFixed(1)}" cy="${dustY.toFixed(1)}" r="${dustR.toFixed(2)}" fill="${phase.window}" fill-opacity="${phase.name === "night" ? ".12" : ".08"}"/>`;
  }).join("") : "";
  const horizonGlow = cinematic ? `<rect class="skyline-horizon-glow" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#skylineHorizonGlow)"/>` : "";
  const cityDepth = cinematic ? `<rect class="skyline-city-depth" x="${x}" y="${(base - Math.max(24, h * .42)).toFixed(1)}" width="${w}" height="${Math.max(28, h * .45).toFixed(1)}" fill="url(#skylineCityDepth)"/>` : "";
  const aerialHaze = cinematic ? `<rect class="skyline-horizon-haze" x="${x}" y="${(base - Math.max(18, h * .27)).toFixed(1)}" width="${w}" height="${Math.max(20, h * .3).toFixed(1)}" fill="url(#skylineHaze)"/>` : "";
  const nearHaze = cinematic ? `<rect class="skyline-near-haze" x="${x}" y="${(base - cityCeiling * .62).toFixed(1)}" width="${w}" height="${(cityCeiling * .64).toFixed(1)}" fill="url(#skylineNearHaze)"/>` : "";
  const vignette = cinematic ? `<rect class="skyline-vignette" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#skylineVignette)" pointer-events="none"/>` : "";
  const grain = cinematic && detail ? `<rect class="skyline-grain" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" filter="url(#skylineGrain)" opacity="${phase.name === "day" ? ".07" : ".08"}" pointer-events="none"/>` : "";
  const shoreTexture = cinematic && detail && waterDepth ? Array.from({ length: 34 }, (_, index) => {
    const stoneX = x + skylineHash(index * 83 + 31) * w;
    const stoneY = base - .5 + skylineHash(index * 59 + 13) * 2.7;
    const stoneR = .22 + skylineHash(index * 101 + 7) * .45;
    return `<circle cx="${stoneX.toFixed(1)}" cy="${stoneY.toFixed(1)}" r="${stoneR.toFixed(2)}" fill="${index % 3 ? phase.grass : phase.window}" fill-opacity="${index % 3 ? ".48" : ".28"}"/>`;
  }).join("") : "";
  const street = cityBase === "park"
    ? `<g class="skyline-street skyline-park"><rect x="${x}" y="${base - 2}" width="${w}" height="${y + h - base + 2}" fill="${skylineMix(phase.field, "#172d25", .28)}"/><path d="M${x} ${base + 4}C${x + w * .28} ${base + 1},${x + w * .68} ${base + 10},${x + w} ${base + 5}" stroke="${skylineMix(phase.grass, "#ded7bd", .62)}" stroke-width="3.2" fill="none" stroke-opacity=".82"/>${Array.from({ length: Math.floor(w / 70) }, (_, i) => { const tx = x + 28 + i * 70; return `<path d="M${tx} ${base + 5}v-8" stroke="#33473c" stroke-width="1"/><circle cx="${tx}" cy="${base - 4}" r="3.2" fill="${phase.grass}" fill-opacity=".78"/>`; }).join("")}</g>`
    : waterDepth
      ? `<g class="skyline-street skyline-shore"><rect x="${x}" y="${base - 2.2}" width="${w}" height="3.4" fill="${skylineMix(phase.grass, "#17232a", .52)}" fill-opacity=".92"/><path d="M${x} ${base}H${x + w}" stroke="${phase.window}" stroke-opacity=".62" stroke-width=".8"/>${shoreTexture}${Array.from({ length: Math.floor(w / 58) }, (_, i) => { const sx = x + 20 + i * 58; return `<circle class="skyline-shore-light" cx="${sx}" cy="${base - 1}" r=".9" fill="${phase.window}" fill-opacity=".76"/><path d="M${sx - 3} ${base + 2}h6" stroke="${phase.window}" stroke-opacity=".23" stroke-width=".6"/>`; }).join("")}</g>`
      : `<g class="skyline-street skyline-transit"><path d="M${x} ${base - 2}H${x + w}V${y + h}H${x}Z" fill="#18232d" fill-opacity=".92"/><path d="M${x} ${base + 2}H${x + w}M${x} ${base + 8}H${x + w}" stroke="${phase.window}" stroke-opacity=".38" stroke-dasharray="12 8" stroke-width=".75"/><path d="M${x} ${base + 13}H${x + w}" stroke="#080d12" stroke-opacity=".82" stroke-width="2.2"/>${Array.from({ length: Math.floor(w / 62) }, (_, i) => { const sx = x + 24 + i * 62; return `<path d="M${sx} ${base - 2}v-8m-2 0h4" stroke="${phase.window}" stroke-opacity=".56" stroke-width=".8"/><circle cx="${sx}" cy="${base - 11}" r="1.1" fill="${phase.window}" fill-opacity=".9"/>`; }).join("")}</g>`;
  const seasonalAccents = !detail || resolvedSeason === "off" || resolvedSeason === "summer"
    ? ""
    : resolvedSeason === "winter"
      ? `<g class="skyline-season skyline-season-winter"><title>Decorative winter season; not a usage metric.</title><path d="M${x} ${base - 2.5}Q${x + w * .18} ${base - 4} ${x + w * .36} ${base - 2.7}T${x + w * .72} ${base - 3.2}T${x + w} ${base - 2.5}" fill="none" stroke="#eef4f4" stroke-opacity=".7" stroke-width="1.6"/></g>`
      : `<g class="skyline-season skyline-season-${resolvedSeason}"><title>Decorative ${resolvedSeason} season; not a usage metric.</title>${Array.from({ length: resolvedSeason === "spring" ? 13 : 10 }, (_, index) => {
        const accentX = x + 10 + skylineHash(index * 73 + 41) * (w - 20);
        const accentY = base - 3.2 - skylineHash(index * 37 + 17) * 2.4;
        const colors = resolvedSeason === "spring" ? ["#e3b6bd", "#f0d2cd", "#a9c68c"] : ["#b86f3d", "#d49a47", "#8f5c3d"];
        return `<circle cx="${accentX.toFixed(1)}" cy="${accentY.toFixed(1)}" r="${(.35 + skylineHash(index * 61 + 9) * .45).toFixed(2)}" fill="${colors[index % colors.length]}" fill-opacity=".74"/>`;
      }).join("")}</g>`;
  const vehicleCount = cityMotion === "auto" && detail && cityBase !== "park"
    ? clamp(Math.floor(Number(mobility.vehicleCount) || 0), 0, 5)
    : 0;
  const pedestrianCount = cityMotion === "auto" && detail
    ? clamp(Math.floor(Number(mobility.pedestrianCount) || 0), 0, 5)
    : 0;
  const vehicleY = cityBase === "transit" ? base + 4.2 : base - 4.1;
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => {
    const actorX = x + 8 + skylineHash(index * 73 + 17) * Math.max(12, w - 28);
    const duration = (18 - (Number(mobility.trafficLevel) || 0) * 5 + skylineHash(index * 41 + 7) * 5) / speed;
    const actorStyle = anim ? ` style="animation-delay:${(-skylineHash(index * 89 + 13) * duration).toFixed(2)}s;animation-duration:${duration.toFixed(2)}s"` : "";
    const bodyColor = ["#d9a35f", "#b75e51", "#6f9aae", "#d8d1bd", "#6f8066"][index % 5];
    return `<g transform="translate(${actorX.toFixed(1)} ${vehicleY.toFixed(1)})"><g class="skyline-vehicle-flow"${actorStyle}><rect x="-3" y="-1.5" width="6" height="2.3" rx=".7" fill="${bodyColor}"/><path d="M-1.7 -1.5L-.7 -2.5H1.1L2.1 -1.5" fill="${skylineMix(bodyColor, "#dce7ec", .3)}"/><circle cx="-1.8" cy="1" r=".55" fill="#090d12"/><circle cx="1.9" cy="1" r=".55" fill="#090d12"/><circle cx="3.1" cy="-.55" r=".38" fill="${phase.window}"/></g></g>`;
  }).join("");
  const pedestrianY = cityBase === "park" ? base + 4 : base - 4.4;
  const pedestrians = Array.from({ length: pedestrianCount }, (_, index) => {
    const actorX = x + 12 + skylineHash(index * 97 + 31) * Math.max(10, w - 24);
    const duration = (24 + skylineHash(index * 53 + 11) * 12) / speed;
    const actorStyle = anim ? ` style="animation-delay:${(-skylineHash(index * 109 + 23) * duration).toFixed(2)}s;animation-duration:${duration.toFixed(2)}s"` : "";
    const variant = index % 4;
    const walkCycle = (.68 + variant * .055) / speed;
    const skin = ["#c99672", "#8f5f46", "#d8aa83", "#a97255"][variant];
    const clothing = ["#52758a", "#9a684f", "#6c7962", "#6f627d"][variant];
    const trousers = ["#263746", "#343038", "#4a4d43", "#2d3342"][variant];
    const hair = ["#30261f", "#171719", "#6a4937", "#252129"][variant];
    const accessory = variant === 1
      ? `<path class="skyline-person-accessory" d="M1.15 -1.25h1.15v1.65H1.15Z" rx=".2" fill="#493b31"/><path d="M1.35 -1.25v-.45h.75v.45" fill="none" stroke="#493b31" stroke-width=".28"/>`
      : variant === 3
        ? `<path class="skyline-person-accessory" d="M-1.45 -2.45Q-2 -1.25-1.55 .1L-.85-.15V-2.45Z" fill="#39475a"/>`
        : "";
    const lowerBody = variant === 2
      ? `<path class="skyline-person-lower" d="M-.78 -.15H.78L1.18 1.2H-1.16Z" fill="${skylineMix(clothing, "#151b22", .18)}"/><g class="skyline-person-legs" fill="none" stroke-linecap="round"><g class="skyline-person-limb skyline-person-leg skyline-person-leg-a"><path d="M-.45 1.1L-.7 2.45" stroke="${skin}" stroke-width=".55"/><path d="M-.96 2.48h.58" stroke="#15191e" stroke-width=".45"/></g><g class="skyline-person-limb skyline-person-leg skyline-person-leg-b"><path d="M.45 1.1L.85 2.35" stroke="${skin}" stroke-width=".55"/><path d="M.6 2.4h.62" stroke="#15191e" stroke-width=".45"/></g></g>`
      : `<g class="skyline-person-legs" fill="none" stroke-linecap="round"><g class="skyline-person-limb skyline-person-leg skyline-person-leg-a"><path d="M-.42 .1L-.8 2.4" stroke="${trousers}" stroke-width=".78"/><path d="M-1.08 2.46h.7" stroke="#15191e" stroke-width=".45"/></g><g class="skyline-person-limb skyline-person-leg skyline-person-leg-b"><path d="M.42 .1L1.02 2.25" stroke="${trousers}" stroke-width=".78"/><path d="M.74 2.34h.72" stroke="#15191e" stroke-width=".45"/></g></g>`;
    return `<g transform="translate(${actorX.toFixed(1)} ${pedestrianY.toFixed(1)})"><g class="skyline-pedestrian-flow"${actorStyle}><g class="skyline-person skyline-person-${variant}" data-person-variant="${variant}"${anim ? ` style="--walk-cycle:${walkCycle.toFixed(2)}s;--walk-half:${(walkCycle / 2).toFixed(2)}s"` : ""}><ellipse class="skyline-person-head" cy="-4" rx=".72" ry=".86" fill="${skin}"/><path class="skyline-person-hair" d="M-.72-4.1Q-.52-5.02.15-4.98Q.78-4.84.75-4.08Q.2-4.5-.72-4.1Z" fill="${hair}"/><path class="skyline-person-neck" d="M-.28-3.28v.48h.56v-.48" fill="${skin}"/><path class="skyline-person-torso" d="M-.78-2.94Q0-3.23.78-2.94L1.02-.25Q.45.2 0 .17Q-.48.2-1.02-.25Z" fill="${clothing}"/><g class="skyline-person-arms" fill="none" stroke-linecap="round"><g class="skyline-person-limb skyline-person-arm skyline-person-arm-a"><path d="M-.78-2.5L-1.38-.45" stroke="${clothing}" stroke-width=".62"/><circle cx="-1.42" cy="-.33" r=".24" fill="${skin}"/></g><g class="skyline-person-limb skyline-person-arm skyline-person-arm-b"><path d="M.78-2.48L1.34-.72" stroke="${clothing}" stroke-width=".62"/><circle cx="1.37" cy="-.6" r=".24" fill="${skin}"/></g></g>${lowerBody}${accessory}</g></g></g>`;
  }).join("");
  const streetLife = vehicleCount || pedestrianCount
    ? `<g class="skyline-street-life" data-recent-sessions="${Math.max(0, Math.floor(Number(mobility.recentSessions) || 0))}" data-active-projects="${Math.max(0, Math.floor(Number(mobility.projectBreadth) || 0))}" data-vehicles="${vehicleCount}" data-pedestrians="${pedestrianCount}"><title>Traffic reflects recent sessions; pedestrians reflect active projects.</title>${vehicles}${pedestrians}</g>`
    : "";
  const greenway = detail && boundedTokenStreak
    ? (() => {
      const start = x + w * (1 - boundedTokenStreak / days.length);
      const end = x + w - 2;
      const greenwayY = waterDepth ? base - 3.8 : base - 5.8;
      const lights = clamp(Math.ceil(boundedTokenStreak / days.length * 9), 1, 9);
      const dots = Array.from({ length: lights }, (_, index) => {
        const progress = lights === 1 ? 1 : index / (lights - 1);
        const lightX = start + (end - start) * progress;
        return `<circle cx="${lightX.toFixed(1)}" cy="${greenwayY.toFixed(1)}" r="${index === lights - 1 ? "1.55" : "1.1"}" fill="#ddf8af" fill-opacity="${index === lights - 1 ? ".95" : ".74"}"/>`;
      }).join("");
      return `<g class="f skyline-greenway" style="${delay(4, .08, speed)}" data-token-streak="${boundedTokenStreak}" data-start-x="${start.toFixed(1)}" data-end-x="${end.toFixed(1)}" data-y="${greenwayY.toFixed(1)}"><title>${boundedTokenStreak}-day token streak</title><path d="M${start.toFixed(1)} ${greenwayY.toFixed(1)}H${end.toFixed(1)}" stroke="${phase.grass}" stroke-width="2.3" stroke-linecap="round"/><path d="M${start.toFixed(1)} ${(greenwayY - .25).toFixed(1)}H${end.toFixed(1)}" stroke="#f1ffd0" stroke-opacity=".42" stroke-width=".55" stroke-linecap="round"/>${dots}</g>`;
    })()
    : "";
  const cinematicDefs = cinematic ? `<radialGradient id="skylineHorizonGlow" cx="52%" cy="92%" r="82%"><stop offset="0" stop-color="${phase.sky[2]}" stop-opacity="${phase.name === "day" ? ".28" : ".48"}"/><stop offset=".5" stop-color="${phase.sky[1]}" stop-opacity=".11"/><stop offset="1" stop-color="${phase.sky[0]}" stop-opacity="0"/></radialGradient><radialGradient id="skylineLuminaryGlow"><stop stop-color="${phase.luminary}" stop-opacity=".24"/><stop offset=".34" stop-color="${phase.luminary}" stop-opacity=".1"/><stop offset="1" stop-color="${phase.luminary}" stop-opacity="0"/></radialGradient><linearGradient id="skylineCityDepth" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${phase.sky[1]}" stop-opacity="0"/><stop offset=".68" stop-color="${skylineMix(phase.sky[1], "#ffffff", .22)}" stop-opacity="${phase.name === "day" ? ".13" : ".08"}"/><stop offset="1" stop-color="${phase.palette.midrise[0]}" stop-opacity=".18"/></linearGradient><linearGradient id="skylineHaze" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${phase.sky[2]}" stop-opacity="0"/><stop offset=".6" stop-color="${phase.sky[2]}" stop-opacity="${phase.name === "day" ? ".09" : ".15"}"/><stop offset="1" stop-color="${phase.window}" stop-opacity=".06"/></linearGradient><linearGradient id="skylineFarFacade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${skylineMix(phase.palette.midrise[0], "#ffffff", .18)}"/><stop offset="1" stop-color="${skylineMix(phase.palette.midrise[0], "#07101d", .56)}"/></linearGradient><linearGradient id="skylineMidFacade" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="${skylineMix(phase.palette.midrise[1], "#ffffff", .2)}"/><stop offset=".5" stop-color="${phase.palette.midrise[0]}"/><stop offset="1" stop-color="${skylineMix(phase.palette.midrise[0], "#07101d", .56)}"/></linearGradient><linearGradient id="skylineCloud" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="${skylineMix(phase.sky[1], "#ffffff", .72)}"/></linearGradient><radialGradient id="skylineVignette"><stop offset=".58" stop-color="#02050b" stop-opacity="0"/><stop offset="1" stop-color="#02050b" stop-opacity="${phase.name === "night" ? ".34" : ".22"}"/></radialGradient><filter id="skylineBuildingShadow" x="-10%" y="-12%" width="120%" height="125%" color-interpolation-filters="sRGB"><feDropShadow dx=".7" dy="1.2" stdDeviation=".85" flood-color="#03101a" flood-opacity="${phase.name === "day" ? ".58" : ".72"}"/></filter><filter id="skylineGrain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="23"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .14"/></feComponentTransfer></filter>` : "";
  const depthDefs = cinematic ? `<linearGradient id="skylineNearHaze" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${phase.sky[1]}" stop-opacity="0"/><stop offset=".72" stop-color="${phase.sky[1]}" stop-opacity="${phase.name === "day" ? ".12" : ".07"}"/><stop offset="1" stop-color="${phase.sky[2]}" stop-opacity="${phase.name === "day" ? ".2" : ".11"}"/></linearGradient><filter id="skylineRearDepth" x="-3%" y="-3%" width="106%" height="106%"><feGaussianBlur stdDeviation="${detail ? ".6" : ".32"}"/></filter><filter id="skylineMiddleDepth" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="${detail ? ".22" : ".12"}"/></filter>` : "";
  const reflectionDefs = cinematic && waterDepth ? `<linearGradient id="skylineReflectionFade" x1="0" y1="${base}" x2="0" y2="${y + h}" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff" stop-opacity=".58"/><stop offset=".48" stop-color="#ffffff" stop-opacity=".24"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient><mask id="skylineReflectionMask" maskUnits="userSpaceOnUse" x="${x}" y="${base}" width="${w}" height="${waterDepth}"><rect x="${x}" y="${base}" width="${w}" height="${waterDepth}" fill="url(#skylineReflectionFade)"/></mask><filter id="skylineReflectionRipple" x="-4%" y="-4%" width="108%" height="112%" color-interpolation-filters="sRGB"><feTurbulence type="turbulence" baseFrequency=".012 .19" numOctaves="1" seed="${citySignature % 97}" result="ripples"/><feDisplacementMap in="SourceGraphic" in2="ripples" scale="${detail ? "1.7" : "1"}" xChannelSelector="R" yChannelSelector="B" result="warped"/><feGaussianBlur in="warped" stdDeviation=".38 1.12"/></filter>` : "";
  const skyStops = cinematic
    ? `<stop stop-color="${skylineMix(phase.sky[0], "#02040a", phase.name === "night" ? .18 : .06)}"/><stop offset=".46" stop-color="${phase.sky[1]}"/><stop offset=".78" stop-color="${skylineMix(phase.sky[1], phase.sky[2], .58)}"/><stop offset="1" stop-color="${phase.sky[2]}"/>`
    : `<stop stop-color="${phase.sky[0]}"/><stop offset=".58" stop-color="${phase.sky[1]}"/><stop offset="1" stop-color="${phase.sky[2]}"/>`;
  const foregroundFilter = cinematic && detail ? ` filter="url(#skylineBuildingShadow)"` : "";
  const rearCity = cinematic ? `<g class="skyline-district-plane skyline-district-plane-rear" filter="url(#skylineRearDepth)">${farBackground.join("")}${background.join("")}${districtLayers[0].join("")}</g>` : `${farBackground.join("")}${background.join("")}${districtLayers[0].join("")}`;
  const middleCity = cinematic ? `<g class="skyline-district-plane skyline-district-plane-middle" filter="url(#skylineMiddleDepth)">${districtLayers[1].join("")}</g>` : districtLayers[1].join("");
  const cityMass = `<g id="skylineCityMass">${rearCity}${aerialHaze}${middleCity}${nearHaze}${fabric}<g class="skyline-foreground"${foregroundFilter}>${foreground.join("")}</g></g>`;
  const cityReflection = cinematic && waterDepth ? `<g class="skyline-reflected-city" mask="url(#skylineReflectionMask)" filter="url(#skylineReflectionRipple)" opacity="${phase.name === "day" ? ".38" : ".44"}"><use href="#skylineCityMass" transform="translate(0 ${(2 * base + .7).toFixed(1)}) scale(1 -1)"/></g>` : "";
  const svg = `<defs><linearGradient id="skylineSky" x1="0" y1="0" x2="0" y2="1">${skyStops}</linearGradient><linearGradient id="skylineWater" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${waterColors[0]}"/><stop offset=".55" stop-color="${cinematic ? skylineMix(waterColors[0], phase.sky[1], .2) : waterColors[0]}"/><stop offset="1" stop-color="${waterColors[1]}"/></linearGradient><radialGradient id="skylineLuminary"><stop stop-color="#fffde1"/><stop offset=".55" stop-color="${phase.luminary}"/><stop offset="1" stop-color="${skylineMix(phase.luminary, phase.sky[1], .18)}"/></radialGradient>${cinematicDefs}${depthDefs}${reflectionDefs}${defs.join("")}</defs><g clip-path="url(#skylineScene)"><rect data-sky="${phase.name}" data-skyline-style="${cinematic ? "cinematic" : "classic"}" data-city-palette="${cityPalette}" data-city-base="${cityBase}" data-city-motion="${cityMotion}" data-weather="${resolvedWeather}" data-season="${resolvedSeason}" data-preset="${escAttr(preset)}" data-city-scale="${cityScale.toFixed(3)}" data-cluster-count="${clusterCount}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#skylineSky)"/>${horizonGlow}${atmosphericDust}${clouds}${weatherBack}${stars}${moonHalo}${luminaryGlow}<circle class="f skyline-luminary" style="${delay(2, .12, speed)}" cx="${luminaryX}" cy="${luminaryY}" r="${luminaryR}" fill="url(#skylineLuminary)"/>${cityDepth}${cityMass}${water}${cityReflection}${reflections.join("")}${street}${seasonalAccents}${streetLife}${greenway}${weatherFront}${vignette}${grain}</g>`;
  const starCss = phase.stars ? `.sky-star{opacity:.18;animation:skylineStarTwinkle ${starCycle.toFixed(2)}s ease-in-out infinite}@keyframes skylineStarTwinkle{0%,100%{opacity:.16}50%{opacity:.52}}` : "";
  const atmosphereCss = cinematic ? `.skyline-cloud-bank{animation:skylineCloudDrift ${(24 / speed).toFixed(2)}s ease-in-out infinite alternate;transform-origin:center}@keyframes skylineCloudDrift{to{transform:translateX(${detail ? "6px" : "3px"})}}.skyline-horizon-haze{animation:skylineHazePulse ${(8 / speed).toFixed(2)}s ease-in-out infinite}@keyframes skylineHazePulse{50%{opacity:.72}}` : "";
  const ambientCss = cinematic ? `.skyline-water-ripple{animation-name:skylineWaterDrift;animation-timing-function:ease-in-out;animation-iteration-count:infinite;transform-box:fill-box;transform-origin:center}@keyframes skylineWaterDrift{0%,100%{opacity:.62;transform:translateX(-2px)}50%{opacity:1;transform:translateX(${detail ? "5px" : "3px"})}}${nightscape ? `.skyline-window-glint{animation-name:skylineWindowGlint;animation-timing-function:ease-in-out;animation-iteration-count:infinite}@keyframes skylineWindowGlint{0%,72%,88%,100%{opacity:1}80%{opacity:.32}84%{opacity:.82}}` : ""}` : "";
  const mobilityCss = streetLife ? `.skyline-vehicle-flow{animation-name:skylineVehicleFlow;animation-timing-function:linear;animation-iteration-count:infinite}@keyframes skylineVehicleFlow{from{transform:translateX(-${(w + 20).toFixed(0)}px)}to{transform:translateX(${(w + 20).toFixed(0)}px)}}.skyline-pedestrian-flow{animation-name:skylinePedestrianFlow;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}@keyframes skylinePedestrianFlow{from{transform:translateX(-18px)}to{transform:translateX(18px)}}.skyline-person{animation:skylinePersonBob var(--walk-half,.36s) ease-in-out infinite alternate}@keyframes skylinePersonBob{to{transform:translateY(-.16px)}}.skyline-person-limb{transform-box:fill-box;transform-origin:center top}.skyline-person-arm{animation:skylineArmSwing var(--walk-cycle,.72s) ease-in-out infinite alternate}@keyframes skylineArmSwing{from{transform:rotate(-16deg)}to{transform:rotate(16deg)}}.skyline-person-leg{animation:skylineLegSwing var(--walk-cycle,.72s) ease-in-out infinite alternate}@keyframes skylineLegSwing{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}.skyline-person-arm-b,.skyline-person-leg-a{animation-direction:alternate-reverse}` : "";
  const weatherCss = resolvedWeather === "rain"
    ? `.skyline-weather-clouds{animation:skylineWeatherCloudDrift ${(26 / speed).toFixed(2)}s ease-in-out infinite alternate}@keyframes skylineWeatherCloudDrift{to{transform:translateX(${detail ? "8px" : "4px"})}}.skyline-rain-drop{animation-name:skylineRainFall;animation-timing-function:linear;animation-iteration-count:infinite}@keyframes skylineRainFall{to{transform:translate(-${detail ? "13" : "7"}px,${(h + 24).toFixed(0)}px)}}`
    : resolvedWeather === "snow"
      ? `.skyline-weather-clouds{animation:skylineWeatherCloudDrift ${(29 / speed).toFixed(2)}s ease-in-out infinite alternate}@keyframes skylineWeatherCloudDrift{to{transform:translateX(${detail ? "6px" : "3px"})}}.skyline-snowflake{animation-name:skylineSnowFall;animation-timing-function:linear;animation-iteration-count:infinite}@keyframes skylineSnowFall{50%{transform:translate(${detail ? "5" : "3"}px,${((h + 20) / 2).toFixed(0)}px)}to{transform:translate(-${detail ? "4" : "2"}px,${(h + 20).toFixed(0)}px)}}`
      : resolvedWeather === "mist"
        ? `.skyline-weather-mist{animation:skylineMistDrift ${(18 / speed).toFixed(2)}s ease-in-out infinite alternate}@keyframes skylineMistDrift{to{transform:translateX(${detail ? "9px" : "4px"});opacity:.72}}`
        : resolvedWeather === "cloudy"
          ? `.skyline-weather-clouds{animation:skylineWeatherCloudDrift ${(28 / speed).toFixed(2)}s ease-in-out infinite alternate}@keyframes skylineWeatherCloudDrift{to{transform:translateX(${detail ? "7px" : "3px"})}}`
          : "";
  const extraCss = anim ? `${starCss}${atmosphereCss}${ambientCss}${mobilityCss}${weatherCss}.skyline-fabric{opacity:0;animation:fu ${(0.7 / speed).toFixed(2)}s cubic-bezier(.4,0,.2,1) forwards}.skyline-building-grow{clip-path:inset(100% 0 0 0) fill-box;animation:skylineBuildingGrow ${(0.8 / speed).toFixed(2)}s cubic-bezier(.2,.6,.2,1) forwards}@keyframes skylineBuildingGrow{to{clip-path:inset(0 0 0 0) fill-box}}` : "";
  return { svg, extraCss, atmosphere: { weather: resolvedWeather, season: resolvedSeason, preset } };
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
  const costLabel = hasUnpricedCodex(stats) ? "Claude est." : "est.";
  const sourceDays = Array.isArray(stats.byDay) ? stats.byDay : [];
  const days = safeDays(sourceDays);
  const signals = chart === "skyline" ? citySignals(days, sourceDays.length) : null;

  const drawChart = CHARTS[chart];
  if (!drawChart) throw new Error(`Unknown chart "${chart}". Available: ${Object.keys(CHARTS).join(", ")}`);
  const box = { x: 20, y: 100, w: W - 40, h: 72 };
  const { svg: chartSvg, extraCss, atmosphere } = drawChart(days, t, box, {
    anim,
    speed,
    sky: opts.sky,
    now: opts.now,
    tokenStreak: signals?.tokenStreak,
    skylineStyle: opts.skylineStyle,
    cityPalette: opts.cityPalette,
    cityBase: opts.cityBase,
    cityMotion: opts.cityMotion,
    weather: opts.weather,
    citySeason: opts.citySeason,
    preset: opts.preset,
    mobility: signals,
  });

  const windowTotal = days.reduce((a, d) => a + d.total, 0);
  const body = `
<defs><linearGradient id="big" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="${t.big[0]}"/><stop offset="100%" stop-color="${t.big[1]}"/>
</linearGradient></defs>
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
<text class="f" x="20" y="27" font-size="14" font-weight="600" fill="${t.title}">⚡ ${esc(title)}</text>
<text class="f" style="${delay(1, 0.12, speed)}" x="20" y="66" font-size="30" font-weight="800" fill="url(#big)">${formatTokens(totals.total)}</text>
<text class="f" style="${delay(2, 0.12, speed)}" x="20" y="85" font-size="10.5" fill="${t.subtext}">tokens all time · ${costLabel} ${formatCost(totals.cost)} · 🔥 ${signals ? signals.tokenStreakDisplay : stats.streak}d ${signals ? "token " : ""}streak</text>
<text class="f" style="${delay(3, 0.12, speed)}" x="${W - 20}" y="97" font-size="9.5" text-anchor="end" fill="${t.subtext}">last ${sourceDays.length}d · ${formatTokens(windowTotal)}</text>
${chartSvg}
<text class="f" style="${delay(8, 0.12, speed)}" x="20" y="${H - 10}" font-size="9.5" fill="${t.subtext}">in ${formatTokens(totals.input)} · out ${formatTokens(totals.output)} · cache ${formatTokens(totals.cacheRead + totals.cacheWrite)}</text>
</g>`;
  const description = atmosphere
    ? `${signals?.description ?? ""} Decorative atmosphere: ${atmosphere.weather} weather, ${atmosphere.season} season; neither is a usage metric.`.trim()
    : signals?.description;
  return frame(W, H, t, title, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }, extraCss), opts.scale, description);
}

export function renderSummary(stats, opts = {}) {
  if (opts.compact) return renderSummaryCompact(stats, opts);
  const { speed = 1, anim = true, title = "Token Stack · Local AI", breakdown = "log" } = opts;
  const t = resolveTheme(opts.theme);
  const W = 495, H = 250;
  const { totals } = stats;
  const costLabel = hasUnpricedCodex(stats) ? "Claude estimate" : "estimated cost";

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
  const days = safeDays(stats.byDay).slice(-14);
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
<text class="f" style="${delay(2, 0.12, speed)}" x="25" y="97" font-size="12" fill="${t.subtext}">tokens all time · ${costLabel} ${formatCost(totals.cost)}</text>
<text class="f" style="${delay(2, 0.12, speed)}" x="255" y="97" font-size="10" text-anchor="end" fill="${t.subtext}">${breakdown === "log" ? "relative log scale" : "raw token scale"}</text>
${rowsSvg}
<text class="f" style="${delay(3, 0.12, speed)}" x="${chartX}" y="112" font-size="11" fill="${t.subtext}">last 14 days · ${formatTokens(sparkTotal)}</text>
${spark}
<line x1="${chartX}" y1="${baseY + 1}" x2="${chartX + chartW}" y2="${baseY + 1}" stroke="${t.border}"/>
<text class="f" style="${delay(8, 0.12, speed)}" x="25" y="${H - 18}" font-size="11" fill="${t.subtext}">${footer}</text>
</g>`;
  return frame(W, H, t, title, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }), opts.scale);
}

export function renderActivity(stats, opts = {}) {
  const { speed = 1, anim = true, title = "Token Activity", chart = "bars" } = opts;
  const t = resolveTheme(opts.theme);
  const sourceDays = Array.isArray(stats.byDay) ? stats.byDay : [];
  const days = safeDays(sourceDays);
  const W = 495, H = 220;
  const skylineLayout = chart === "skyline";
  const signals = skylineLayout ? citySignals(days, sourceDays.length) : null;
  const skylinePhase = skylineLayout ? resolveSkyPhase(opts.sky, opts.now) : null;
  const displayTitle = skylineLayout && String(title).length > 20
    ? `${String(title).slice(0, 19)}…`
    : String(title);
  const chartX = skylineLayout ? 14 : 25;
  const chartW = W - chartX * 2;
  const baseY = skylineLayout ? 179 : 178;
  const chartH = skylineLayout ? 148 : 108;
  const headerY = skylineLayout ? 20 : 33;
  const dateY = skylineLayout ? 212 : baseY + 18;
  const windowTotal = days.reduce((a, d) => a + d.total, 0);
  const windowCost = days.reduce((a, d) => a + d.cost, 0);
  const skylineCostLabel = hasUnpricedCodex(stats) ? "CLAUDE EST." : "EST. COST";
  const drawChart = chart === "skyline" ? chartSkylineContinuous : chartBars;
  const { svg: chartSvg, extraCss, atmosphere } = drawChart(days, t, { x: chartX, y: baseY - chartH, w: chartW, h: chartH }, {
    anim,
    speed,
    sky: opts.sky,
    now: opts.now,
    tokenStreak: signals?.tokenStreak,
    skylineStyle: opts.skylineStyle,
    cityPalette: opts.cityPalette,
    cityBase: opts.cityBase,
    cityMotion: opts.cityMotion,
    weather: opts.weather,
    citySeason: opts.citySeason,
    preset: opts.preset,
    mobility: signals,
  });
  const skylineReadout = signals
    ? (() => {
      const streakLabel = signals.tokenStreak ? `${signals.tokenStreakDisplay}D` : "NO";
      const streakColor = skylinePhase?.grass ?? t.big[1];
      return `<g class="f skyline-readout skyline-legend" style="${delay(2, .1, speed)}" data-rhythm="${signals.rhythm}" data-active-days="${signals.activeDays}" data-window-days="${signals.windowDays}" data-token-streak="${signals.tokenStreak}" data-recent-sessions="${signals.recentSessions}" data-active-projects="${signals.projectBreadth}"><title>Building height represents daily tokens. City density represents sustained token activity. The green route represents the current streak. Traffic reflects recent sessions and pedestrians reflect active projects. ${signals.readout}</title><g class="skyline-legend-height"><rect x="25" y="190" width="2.5" height="5" rx=".55" fill="${t.big[0]}"/><rect x="29" y="187" width="2.5" height="8" rx=".55" fill="${t.big[0]}"/><rect x="33" y="183" width="2.5" height="12" rx=".55" fill="${t.big[1]}"/><text x="41" y="187" font-size="6.2" font-weight="650" letter-spacing=".38" fill="${t.subtext}">BUILDING HEIGHT</text><text x="41" y="195" font-size="8.3" font-weight="650" fill="${t.title}">DAILY TOKENS</text></g><path d="M174 182V197" stroke="${t.border}" stroke-opacity=".58" stroke-width=".65"/><g class="skyline-legend-active"><circle cx="193" cy="185" r="1.25" fill="${t.big[0]}" fill-opacity=".45"/><circle cx="198" cy="188" r="1.75" fill="${t.big[0]}" fill-opacity=".68"/><circle cx="203" cy="184" r="2.15" fill="${t.big[1]}" fill-opacity=".88"/><text x="211" y="187" font-size="6.2" font-weight="650" letter-spacing=".38" fill="${t.subtext}">CITY DENSITY</text><text x="211" y="195" font-size="8.3" font-weight="650" fill="${t.title}">${signals.activeDays}/${signals.windowDays} ACTIVE DAYS</text></g><path d="M344 182V197" stroke="${t.border}" stroke-opacity=".58" stroke-width=".65"/><g class="skyline-legend-streak"><path d="M361 185.5H380" stroke="${streakColor}" stroke-width="1.8" stroke-linecap="round"/><circle cx="380" cy="185.5" r="1.45" fill="${streakColor}"/><text x="387" y="187" font-size="5.7" font-weight="650" letter-spacing=".25" fill="${t.subtext}">STREAK · SESSIONS / PROJECTS</text><text x="470" y="195" font-size="8.3" font-weight="650" text-anchor="end" fill="${t.subtext}"><tspan fill="${streakColor}">${streakLabel}</tspan> · ${signals.recentSessions} / ${signals.projectBreadth}</text></g><path class="skyline-legend-rule" d="M14 199H481" stroke="${t.border}" stroke-opacity=".48" stroke-width=".7"/></g>`;
    })()
    : "";
  const skylineHeader = skylineLayout
    ? `<g class="f skyline-header"><g class="skyline-title-mark"><rect x="25" y="13" width="2.6" height="6" rx=".5" fill="${t.big[0]}"/><rect x="29" y="10" width="2.6" height="9" rx=".5" fill="${t.big[0]}"/><rect x="33" y="7" width="2.6" height="12" rx=".5" fill="${t.big[1]}"/></g><text x="45" y="20" font-size="13" font-weight="650" letter-spacing=".08" fill="${t.title}">${esc(displayTitle)}</text></g><g class="f skyline-header-metrics" style="${delay(1, .12, speed)}" data-window-tokens="${windowTotal}" data-window-cost="${windowCost.toFixed(2)}" data-window-days="${sourceDays.length}"><path d="M337 7V23M414 7V23" stroke="${t.border}" stroke-opacity=".45" stroke-width=".6"/><g class="skyline-header-token"><text x="302" y="11" font-size="5.7" font-weight="650" letter-spacing=".55" text-anchor="middle" fill="${t.subtext}">TOKENS</text><text x="302" y="21" font-size="9.3" font-weight="650" text-anchor="middle" fill="${t.title}">${formatTokens(windowTotal)}</text></g><g class="skyline-header-cost"><text x="376" y="11" font-size="5.7" font-weight="650" letter-spacing=".55" text-anchor="middle" fill="${t.subtext}">${skylineCostLabel}</text><text x="376" y="21" font-size="9.3" font-weight="650" text-anchor="middle" fill="${t.title}">${formatCost(windowCost)}</text></g><g class="skyline-header-window"><text x="447" y="11" font-size="5.7" font-weight="650" letter-spacing=".55" text-anchor="middle" fill="${t.subtext}">WINDOW</text><text x="447" y="21" font-size="9.3" font-weight="650" text-anchor="middle" fill="${t.title}">${sourceDays.length}D</text></g></g>`
    : "";

  const body = `
<g font-family="'Segoe UI',Ubuntu,Sans-Serif">
${skylineHeader}
${skylineLayout ? "" : `<text class="f" x="25" y="${headerY}" font-size="16" font-weight="600" fill="${t.title}">📊 ${esc(title)}</text>`}
${skylineLayout ? "" : `<text class="f" style="${delay(1, 0.12, speed)}" x="${W - 25}" y="${headerY}" font-size="12" text-anchor="end" fill="${t.subtext}">${formatTokens(windowTotal)} · ${formatCost(windowCost)} · ${sourceDays.length}d</text>`}
${skylineReadout}
${chartSvg}
<text x="${chartX}" y="${dateY}" font-size="${skylineLayout ? "9.7" : "10"}" fill="${t.subtext}">${esc(days[0]?.date ?? "")}</text>
<text x="${chartX + chartW}" y="${dateY}" font-size="${skylineLayout ? "9.7" : "10"}" text-anchor="end" fill="${t.subtext}">${esc(days[days.length - 1]?.date ?? "")}</text>
</g>`;
  const description = atmosphere
    ? `${signals?.description ?? ""} Decorative atmosphere: ${atmosphere.weather} weather, ${atmosphere.season} season; neither is a usage metric.`.trim()
    : signals?.description;
  return frame(W, H, t, title, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }, extraCss), opts.scale, description);
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
  return frame(W, H, t, title, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }, donutKeyframes), opts.scale);
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
  return frame(W, H, t, title, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }), opts.scale);
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
  return frame(W, H, t, `Agent Passport: ${label}`, body, styles({ anim, speed, motionPolicy: opts.motionPolicy }, extraCss), opts.scale);
}

export const CARDS = {
  summary: renderSummary,
  activity: renderActivity,
  models: renderModels,
  agents: renderAgents,
  passport: renderPassport,
};
