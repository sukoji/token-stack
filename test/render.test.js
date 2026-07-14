import assert from "node:assert/strict";
import test from "node:test";
import { renderActivity, renderAgents, renderPassport, renderSummary, renderSummaryCompact } from "../src/render.js";

test("compact card renders a static accessible SVG", () => {
  const svg = renderSummaryCompact({ totals: { total: 1000, cost: 0.01, input: 400, output: 300, cacheRead: 200, cacheWrite: 100 }, byDay: [{ date: "2026-07-01", total: 1000, cost: 0.01 }], streak: 1 }, { anim: false, chart: "bars" });
  assert.match(svg, /<svg/);
  assert.match(svg, /role="img"/);
  assert.doesNotMatch(svg, /animation:/);
});

test("agent card shows a percentage distribution", () => {
  const svg = renderAgents({ totals: { total: 0 }, agentSessions: 10, byAgentActivity: [{ name: "claude-code", sessions: 6 }, { name: "codex", sessions: 4 }] }, { anim: false });
  assert.match(svg, /claude-code/);
  assert.match(svg, /60\.0%/);
  assert.match(svg, /6 sessions/);
  assert.match(svg, /width="495" height="165"/);
  assert.match(svg, /x="165"/);
});

test("skyline chart renders a night city for compact and activity cards", () => {
  const stats = { totals: { total: 1000, cost: 1, input: 1, output: 1, cacheRead: 1, cacheWrite: 1 }, byDay: [{ date: "2026-07-01", total: 0, cost: 0 }, { date: "2026-07-02", total: 10, cost: 0.1 }, { date: "2026-07-03", total: 30, cost: 0.15 }, { date: "2026-07-04", total: 55, cost: 0.2 }, { date: "2026-07-05", total: 100, cost: 0.5 }], streak: 1 };
  assert.match(renderSummaryCompact(stats, { anim: false, chart: "skyline", sky: "day" }), /data-sky="day"/);
  const activity = renderActivity(stats, { anim: false, chart: "skyline", sky: "night" });
  assert.match(activity, /skyline-luminary/);
  assert.match(activity, /data-sky="night"/);
  assert.match(activity, /skyline-fabric/);
  assert.match(activity, /skyline-house/);
  assert.match(activity, /skyline-midrise/);
  assert.match(activity, /skyline-landmark/);
  assert.match(activity, /skyline-window/);
  assert.match(activity, /skyline-street/);
  assert.match(activity, /<rect x="14" y="43" width="467" height="153" rx="7"\/>/);
  assert.match(activity, /clipPath id="skylineClip/);
  assert.match(activity, /clip-path="url\(#skylineClip/);
});

test("metropolis skyline preserves height contrast and renders a layered night waterfront", () => {
  const pattern = [21, 25, 33, 41, 55, 42, 32, 24, 35, 126, 252, 96, 52, 37, 45, 186, 456, 234, 84, 51, 37, 32, 42, 93, 216, 79, 36, 19, 27, 47];
  const byDay = pattern.map((value, index) => ({
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
    total: value * 1_000_000,
    cost: 0,
  }));
  const stats = {
    totals: { total: byDay.reduce((sum, day) => sum + day.total, 0), cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay,
    streak: 30,
  };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "night" });
  const heights = [...svg.matchAll(/data-height="([0-9.]+)"/g)].map((match) => Number(match[1])).sort((a, b) => a - b);
  const p20 = heights[Math.floor((heights.length - 1) * .2)];
  const p90 = heights[Math.floor((heights.length - 1) * .9)];
  assert.ok(heights.at(-1) - p20 >= 35);
  assert.ok(p90 / p20 >= 1.8);
  assert.match(svg, /data-city-scale="1\.000"/);
  assert.match(svg, /skyline-water/);
  assert.match(svg, /skyline-reflection/);
  assert.match(svg, /skyline-moon-halo/);
  assert.match(svg, /skyline-window-warm/);
  assert.match(svg, /skyline-window-cool/);
  assert.match(svg, /skyline-crown-band/);
  const landmarks = svg.match(/class="skyline-landmark"/g) ?? [];
  assert.ok(landmarks.length >= 1 && landmarks.length <= 2);
  const landmarkDimensions = [...svg.matchAll(/class="skyline-landmark" data-height="([0-9.]+)" data-width="([0-9.]+)"/g)];
  assert.ok(landmarkDimensions.every(([, height, width]) => Number(height) / Number(width) >= 4));
  const landmarkShapes = [...svg.matchAll(/skyline-landmark-(\d)/g)].map((match) => match[1]);
  assert.equal(new Set(landmarkShapes).size, landmarkShapes.length);

  const reachableShapes = new Set();
  for (let month = 1; month <= 9; month++) {
    const shifted = {
      ...stats,
      byDay: byDay.map((day, index) => ({
        ...day,
        date: `2026-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
      })),
    };
    const variant = renderActivity(shifted, { anim: false, chart: "skyline", sky: "night" });
    for (const match of variant.matchAll(/skyline-landmark-(\d)/g)) reachableShapes.add(match[1]);
  }
  assert.deepEqual([...reachableShapes].sort(), ["0", "1", "2", "3", "4"]);

  const autoNight = renderActivity(stats, { anim: false, chart: "skyline", now: new Date(2026, 0, 1, 23, 0) });
  assert.match(autoNight, /data-sky="night"/);

  const compact = renderSummaryCompact(stats, { anim: false, chart: "skyline", sky: "night" });
  const compactHeights = [...compact.matchAll(/data-height="([0-9.]+)"/g)].map((match) => Number(match[1]));
  assert.ok(compactHeights.every((height) => height <= 72 * .78 + .1));
});

test("all-zero skyline is a field rather than an empty block chart", () => {
  const stats = { totals: { total: 0, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, byDay: [{ date: "2026-07-01", total: 0, cost: 0 }, { date: "2026-07-02", total: 0, cost: 0 }], streak: 0 };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "day" });
  assert.match(svg, /skyline-field/);
  assert.doesNotMatch(svg, /skyline-landmark/);
});

test("skyline does not turn a sustained activity plateau into repeated towers", () => {
  const stats = {
    totals: { total: 1, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      total: i >= 9 && i <= 18 ? 1000 : 120,
      cost: 0,
    })),
    streak: 0,
  };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "day" });
  const landmarks = svg.match(/class="skyline-landmark"/g) ?? [];
  assert.ok(landmarks.length <= 2);
  assert.doesNotMatch(svg, /skyline-crown/);
});

test("a completely even skyline stays a city district without forced landmarks", () => {
  const stats = {
    totals: { total: 1, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, total: 500, cost: 0 })),
    streak: 0,
  };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "day" });
  assert.doesNotMatch(svg, /skyline-landmark/);
  assert.match(svg, /skyline-midrise/);
});

test("continuous skyline stays deterministic and valid across history lengths", () => {
  for (const count of [5, 30, 180]) {
    const stats = {
      totals: { total: 1, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      byDay: Array.from({ length: count }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, total: i % 11 === 0 ? 1000 : i % 4 === 0 ? 90 : i % 3 === 0 ? 12 : 0, cost: 0 })),
      streak: 0,
    };
    const first = renderActivity(stats, { anim: false, chart: "skyline", sky: "dusk" });
    const second = renderActivity(stats, { anim: false, chart: "skyline", sky: "dusk" });
    assert.equal(first, second);
    assert.match(first, /skyline-fabric/);
    assert.doesNotMatch(first, /NaN|undefined/);
  }
});

test("scale changes intrinsic SVG dimensions without changing its viewBox", () => {
  const svg = renderSummaryCompact({ totals: { total: 0, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, byDay: [{ date: "2026-07-01", total: 0, cost: 0 }], streak: 0 }, { anim: false, scale: 1.5 });
  assert.match(svg, /width="510" height="300" viewBox="0 0 340 200"/);
});

test("summary defaults to a log breakdown but can use raw proportions", () => {
  const stats = { totals: { total: 1000110, cost: 1, input: 100, output: 10, cacheRead: 1000000, cacheWrite: 0 }, byDay: [{ date: "2026-07-01", total: 1, cost: 0 }], streak: 0, activeDays: 1, byModel: [] };
  const log = renderSummary(stats, { anim: false });
  const raw = renderSummary(stats, { anim: false, breakdown: "raw" });
  assert.match(log, /relative log scale/);
  assert.match(raw, /raw token scale/);
});

test("passport derives a shareable archetype from session activity", () => {
  const svg = renderPassport({ agentSessions: 12, byAgentActivity: [{ name: "claude-code", sessions: 6 }, { name: "codex", sessions: 4 }, { name: "antigravity", sessions: 2 }], byModel: [{ name: "claude-sonnet", total: 1 }], streak: 5 }, { anim: false, name: "sukoji" });
  assert.match(svg, /Multi-Agent Operator/);
  assert.match(svg, /SUKOJI/);
  assert.match(svg, /AGENT PASSPORT/);
  assert.match(svg, /passport-orbit/);
  assert.match(svg, /PRIVATE BY DESIGN/);
  assert.doesNotMatch(svg, /class="f"[^>]*transform="translate/);
});

test("passport can embed an opt-in avatar without an external image request", () => {
  const avatar = "data:image/png;base64,iVBORw0KGgo=";
  const svg = renderPassport({ agentSessions: 1, byAgentActivity: [], byModel: [], streak: 0 }, { anim: false, avatarDataUri: avatar });
  assert.match(svg, /passportAvatarClip/);
  assert.match(svg, new RegExp(avatar));
});
