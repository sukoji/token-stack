import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderActivity, renderSummaryCompact } from "../src/render.js";

const END_DATE = new Date("2026-07-14T00:00:00Z");
const SKY_MODES = ["dawn", "day", "dusk", "night"];

function dates(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(END_DATE);
    date.setUTCDate(END_DATE.getUTCDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function profile(id, label, sky, values, note) {
  const byDay = dates(values.length).map((date, index) => ({
    date,
    total: Math.max(0, Math.round(values[index])),
    cost: Math.max(0, values[index]) * 4.7e-7,
  }));
  const total = byDay.reduce((sum, day) => sum + day.total, 0);
  let streak = 0;
  for (let index = byDay.length - 1; index >= 0 && byDay[index].total > 0; index--) streak++;
  return {
    id,
    label,
    sky,
    note,
    stats: {
      totals: { total, cost: total * 4.7e-7, input: total, output: 0, cacheRead: 0, cacheWrite: 0 },
      byDay,
      streak,
    },
  };
}

const wave = (index, base, amplitude, frequency = .45) =>
  base + amplitude * (.5 + .5 * Math.sin(index * frequency));

export const skylineCases = [
  profile("empty-window", "Empty window · defensive fallback", "night", []),
  profile("single-day", "Single day · bounded neighborhood", "day", [320_000]),
  profile("empty", "New user · no token data", "dawn", Array(30).fill(0), "Expected field state"),
  profile("first-week", "First week · sparse, tiny usage", "day", [0, 1_200, 0, 4_800, 2_000, 0, 9_000]),
  profile("steady", "Steady builder · moderate activity", "day", Array.from({ length: 30 }, (_, i) => wave(i, 420_000, 260_000))),
  profile("weekends", "Weekend bursts · sparse rhythm", "dusk", Array.from({ length: 30 }, (_, i) => i % 7 >= 5 ? wave(i, 5_000_000, 2_500_000) : 90_000)),
  profile("spiky", "Launch month · isolated peaks", "night", Array.from({ length: 30 }, (_, i) => 180_000 + (i === 8 ? 34_000_000 : 0) + (i === 23 ? 67_000_000 : 0))),
  profile("plateau", "Sustained plateau · dense district", "dusk", Array.from({ length: 30 }, (_, i) => i >= 7 && i <= 22 ? 9_000_000 : 1_400_000)),
  profile("metropolis", "Heavy user · 90-day metropolis", "night", Array.from({ length: 90 }, (_, i) => wave(i, 1_900_000_000, 1_200_000_000, .22) + (i === 24 ? 16_000_000_000 : 0) + (i === 67 ? 28_000_000_000 : 0))),
  profile("long-history", "Long history · 365-day compression", "day", Array.from({ length: 365 }, (_, i) => wave(i, 16_000_000, 11_000_000, .08) + (i % 73 === 0 ? 120_000_000 : 0))),
  profile("extreme", "Extreme numeric bound · finite geometry", "night", Array.from({ length: 30 }, (_, i) => i === 14 ? Number.MAX_SAFE_INTEGER : i % 5 === 0 ? 1 : 0)),
];

function assertReferencesResolve(svg, label) {
  const idList = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const ids = new Set(idList);
  assert.equal(ids.size, idList.length, `${label}: duplicate SVG id`);
  for (const [, reference] of svg.matchAll(/url\(#([^\)]+)\)/g)) {
    assert.ok(ids.has(reference), `${label}: unresolved SVG reference #${reference}`);
  }
}

function expectedCitySignals(stats) {
  const sourceDays = Array.isArray(stats.byDay) ? stats.byDay : [];
  const activeDays = sourceDays.filter((day) => Number.isFinite(day?.total) && day.total > 0).length;
  let tokenStreak = 0;
  for (let index = sourceDays.length - 1; index >= 0 && Number.isFinite(sourceDays[index]?.total) && sourceDays[index].total > 0; index--) tokenStreak++;
  return { activeDays, windowDays: sourceDays.length, tokenStreak };
}

function assertHealthySvg(svg, { label, compact, sky, stats }) {
  assert.match(svg, /^<svg\b[\s\S]*<\/svg>$/, `${label}: incomplete SVG`);
  assert.doesNotMatch(svg, /\b(?:NaN|Infinity|undefined)\b/, `${label}: non-finite output`);
  assert.doesNotMatch(svg, /<(?:script|image)\b|(?:href|xlink:href)=["']https?:/i, `${label}: external or executable content`);
  assert.match(svg, new RegExp(`data-sky="${sky}"`), `${label}: wrong sky phase`);
  assertReferencesResolve(svg, label);
  assert.ok(Buffer.byteLength(svg) < (compact ? 55_000 : 120_000), `${label}: SVG unexpectedly exceeds the verified size budget`);

  const sceneHeight = compact ? 72 : 153;
  const dimensions = [...svg.matchAll(/<g class="skyline-(house|midrise|highrise|landmark)" data-height="([0-9.]+)" data-width="([0-9.]+)" data-score="([0-9.]+)" data-density="([0-9.]+)"/g)];
  assert.ok(dimensions.length <= (compact ? 31 : 44), `${label}: too many foreground buildings`);
  for (const [, tier, heightText, widthText, scoreText, densityText] of dimensions) {
    const height = Number(heightText);
    const width = Number(widthText);
    const score = Number(scoreText);
    const density = Number(densityText);
    assert.ok(Number.isFinite(height) && height > 0 && height <= sceneHeight * .78 + .11, `${label}: building height ${height} is outside the scene`);
    assert.ok(Number.isFinite(width) && width > 0, `${label}: building width ${width} is invalid`);
    assert.ok(score >= 0 && score <= 1 && density >= 0 && density <= 1, `${label}: normalized building metadata is invalid`);
    if (tier === "landmark") assert.ok(height / width >= (compact ? 3 : 4) - .02, `${label}: landmark is not slender enough`);
    else assert.ok(width <= (compact ? 32 : 50), `${label}: ordinary building is too wide`);
  }

  for (const [, radiusText] of svg.matchAll(/class="skyline-field"[\s\S]*?<circle[^>]+\br="([0-9.]+)"/g)) {
    assert.ok(Number(radiusText) <= (compact ? 3.5 : 5.5), `${label}: field tree is too large`);
  }

  const clips = new Map([...svg.matchAll(/<clipPath id="(skylineClip[^"]+)"><path d="([^"]+)"\/><\/clipPath>/g)].map((match) => [match[1], match[2]]));
  for (const match of svg.matchAll(/<path class="by skyline-building [^"]+"[^>]+d="([^"]+)"[^>]*\/><g clip-path="url\(#([^\)]+)\)"/g)) {
    assert.equal(clips.get(match[2]), match[1], `${label}: facade clip does not match its building silhouette`);
  }

  const landmarks = svg.match(/class="skyline-landmark"/g) ?? [];
  assert.ok(landmarks.length <= (compact ? 1 : 2), `${label}: too many landmarks`);
  const signals = expectedCitySignals(stats);
  assert.match(svg, /<desc>Building height represents daily tokens\./, `${label}: skyline needs an accessible token-height explanation`);
  assert.doesNotMatch(svg, /\b(?:GitHub|PR|contribution|language)\b/i, `${label}: skyline claimed unavailable external context`);
  if (compact) {
    assert.doesNotMatch(svg, /skyline-readout|skyline-greenway|skyline-encoding/, `${label}: compact card should keep the scene clean`);
  } else {
    const readouts = svg.match(/class="f skyline-readout"/g) ?? [];
    assert.equal(readouts.length, 1, `${label}: full card needs one city readout`);
    assert.match(svg, /HEIGHT = DAILY TOKENS/, `${label}: full card lost its height explanation`);
    assert.match(svg, new RegExp(`data-active-days="${signals.activeDays}"`), `${label}: readout active-day count disagrees with daily token data`);
    assert.match(svg, new RegExp(`data-window-days="${signals.windowDays}"`), `${label}: readout window length disagrees with daily token data`);
    assert.match(svg, new RegExp(`data-token-streak="${signals.tokenStreak}"`), `${label}: readout streak disagrees with daily token data`);
    if (signals.tokenStreak) {
      const displayedStreak = signals.tokenStreak === signals.windowDays ? `≥${signals.tokenStreak}` : String(signals.tokenStreak);
      assert.match(svg, new RegExp(`GREEN PATH = ${displayedStreak}D STREAK`), `${label}: readout must distinguish a full-window lower-bound streak`);
    }
    const greenways = svg.match(/class="f skyline-greenway"/g) ?? [];
    if (signals.tokenStreak) {
      assert.equal(greenways.length, 1, `${label}: an active token streak needs one greenway`);
      const greenway = svg.match(/class="f skyline-greenway"[^>]+data-token-streak="([0-9]+)"[^>]+data-start-x="([0-9.]+)"[^>]+data-end-x="([0-9.]+)"[^>]+data-y="([0-9.]+)"/);
      assert.ok(greenway, `${label}: greenway data geometry is missing`);
      const [, streak, start, end, y] = greenway;
      assert.equal(Number(streak), signals.tokenStreak, `${label}: greenway streak is wrong`);
      assert.ok(Number(start) >= 14 && Number(end) <= 481 && Number(start) <= Number(end), `${label}: greenway left/right bounds escape the scene`);
      assert.ok(Number(y) >= 43 && Number(y) <= 196, `${label}: greenway vertical position escapes the scene`);
    } else {
      assert.equal(greenways.length, 0, `${label}: zero token streak should not draw a greenway`);
    }
  }
}

export function verifySkylineMatrix() {
  const results = [];
  for (const item of skylineCases) {
    let fullGeometry;
    let fullReadout;
    for (const sky of SKY_MODES) {
      const fullOptions = { anim: false, chart: "skyline", theme: "tokyonight", sky };
      const full = renderActivity(item.stats, fullOptions);
      assert.equal(full, renderActivity(item.stats, fullOptions), `${item.id}/${sky}: renderer is not deterministic`);
      assertHealthySvg(full, { label: `${item.id}/${sky}/full`, compact: false, sky, stats: item.stats });
      const geometry = [...full.matchAll(/<g class="skyline-(?:house|midrise|highrise|landmark)" data-height="[^"]+" data-width="[^"]+" data-score="[^"]+" data-density="[^"]+"/g)].map((match) => match[0]);
      if (fullGeometry) assert.deepEqual(geometry, fullGeometry, `${item.id}: sky phase changed city geometry`);
      else fullGeometry = geometry;
      const readout = full.match(/<g class="f skyline-readout"[^>]+>/)?.[0] ?? "";
      if (fullReadout) assert.equal(readout, fullReadout, `${item.id}: sky phase changed city semantics`);
      else fullReadout = readout;
      const maxDaily = Math.max(...item.stats.byDay.map((day) => day.total), 0);
      if (maxDaily <= 25_000) {
        assert.doesNotMatch(full, /skyline-(?:highrise|landmark)/, `${item.id}: village-scale activity produced a tower`);
        if (maxDaily > 0) assert.match(full, /skyline-house/, `${item.id}: village-scale activity should produce homes`);
      }
      if (maxDaily === 0) assert.doesNotMatch(full, /class="skyline-(?:house|midrise|highrise|landmark)"/, `${item.id}: zero activity produced a building`);
      results.push({ id: item.id, sky, layout: "full", bytes: Buffer.byteLength(full), landmarks: full.match(/class="skyline-landmark"/g)?.length ?? 0 });

      const compactOptions = { anim: false, chart: "skyline", theme: "tokyonight", sky };
      const compact = renderSummaryCompact(item.stats, compactOptions);
      assert.equal(compact, renderSummaryCompact(item.stats, compactOptions), `${item.id}/${sky}/compact: renderer is not deterministic`);
      assertHealthySvg(compact, { label: `${item.id}/${sky}/compact`, compact: true, sky, stats: item.stats });
      results.push({ id: item.id, sky, layout: "compact", bytes: Buffer.byteLength(compact), landmarks: compact.match(/class="skyline-landmark"/g)?.length ?? 0 });
    }
  }
  return results;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function writeSkylineGallery(file = path.join(os.tmpdir(), "token-stack-skyline-matrix.html")) {
  const cards = skylineCases.map((item) => {
    const svg = renderActivity(item.stats, { anim: false, chart: "skyline", theme: "tokyonight", sky: item.sky });
    const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const total = item.stats.totals.total.toLocaleString("en-US");
    return `<article><header><strong>${esc(item.label)}</strong><span>${item.stats.byDay.length}d · ${esc(item.sky)} · ${total} tokens</span></header><img src="${image}" width="495" height="220" alt="${esc(item.label)}">${item.note ? `<p>${esc(item.note)}</p>` : ""}</article>`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Token Stack skyline verification</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#090d16;color:#d9e2f2;font:14px/1.4 system-ui,sans-serif}.intro{max-width:1040px;margin:0 auto 20px}.grid{display:grid;grid-template-columns:repeat(2,495px);gap:22px 28px;justify-content:center}article{width:495px}header{display:flex;justify-content:space-between;align-items:baseline;margin:0 3px 7px;color:#c9d7ee}header span{font-size:11px;color:#8090aa}img{display:block}p{margin:6px 3px 0;font-size:11px;color:#8090aa}@media(max-width:1060px){.grid{grid-template-columns:495px}}</style></head><body><div class="intro"><h1>Token Stack skyline matrix</h1><p>Deterministic reference profiles spanning empty, sparse, steady, bursty, plateau, heavy and long-history usage.</p></div><main class="grid">${cards}</main></body></html>`;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, html);
  return path.resolve(file);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const results = verifySkylineMatrix();
  const outIndex = process.argv.indexOf("--out");
  const output = writeSkylineGallery(outIndex >= 0 ? process.argv[outIndex + 1] : undefined);
  const maxBytes = Math.max(...results.map((result) => result.bytes));
  console.log(`verified ${results.length} skyline renders across ${skylineCases.length} profiles`);
  console.log(`largest SVG: ${maxBytes.toLocaleString("en-US")} bytes`);
  console.log(`gallery: ${output}`);
}
