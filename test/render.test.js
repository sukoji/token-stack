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
  const stats = { totals: { total: 19_300_000, cost: 9, input: 19_300_000, output: 0, cacheRead: 0, cacheWrite: 0 }, byDay: [{ date: "2026-07-01", total: 0, cost: 0 }, { date: "2026-07-02", total: 800_000, cost: 0.4 }, { date: "2026-07-03", total: 2_500_000, cost: 1.2 }, { date: "2026-07-04", total: 6_000_000, cost: 2.8 }, { date: "2026-07-05", total: 10_000_000, cost: 4.6 }], streak: 1 };
  assert.match(renderSummaryCompact(stats, { anim: false, chart: "skyline", sky: "day" }), /data-sky="day"/);
  const activity = renderActivity(stats, { anim: false, chart: "skyline", sky: "night" });
  assert.match(activity, /skyline-luminary/);
  assert.match(activity, /data-sky="night"/);
  assert.match(activity, /data-skyline-style="cinematic"/);
  assert.match(activity, /skyline-horizon-glow/);
  assert.match(activity, /skyline-far-building/);
  assert.match(activity, /skyline-edge-light/);
  assert.match(activity, /skyline-fabric/);
  assert.match(activity, /skyline-house/);
  assert.match(activity, /skyline-midrise/);
  assert.match(activity, /skyline-landmark/);
  assert.match(activity, /skyline-window/);
  assert.match(activity, /skyline-street/);
  assert.match(activity, /class="f skyline-readout\b/);
  assert.match(activity, /class="f skyline-header"/);
  assert.match(activity, /DAILY TOKENS → HEIGHT/);
  assert.match(activity, /class="f skyline-greenway"[^>]+data-token-streak="4"/);
  assert.match(activity, /<desc>Building height represents daily tokens\./);
  assert.match(activity, /<rect x="14" y="31" width="467" height="148" rx="7"\/>/);
  assert.match(activity, /class="skyline-legend-rule" d="M14 199H481"/);
  assert.match(activity, /clipPath id="skylineClip/);
  assert.match(activity, /clip-path="url\(#skylineClip/);
});

test("classic skyline remains available without cinematic material layers", () => {
  const stats = {
    totals: { total: 4_200_000, cost: 2, input: 4_200_000, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: [120_000, 400_000, 900_000, 2_780_000].map((total, index) => ({ date: `2026-07-${String(index + 1).padStart(2, "0")}`, total, cost: 0 })),
    streak: 4,
  };
  const classic = renderActivity(stats, { anim: false, chart: "skyline", sky: "night", skylineStyle: "classic" });
  assert.match(classic, /data-skyline-style="classic"/);
  assert.doesNotMatch(classic, /skyline-horizon-glow|skyline-far-building|skyline-edge-light|skylineMaterial/);
  assert.throws(() => renderActivity(stats, { anim: false, chart: "skyline", skylineStyle: "photoreal" }), /Unknown skyline style/);
});

test("animated skyline grows its facade and windows from the street upward", () => {
  const stats = {
    totals: { total: 19_300_000, cost: 9, input: 19_300_000, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: [0, 800_000, 2_500_000, 6_000_000, 10_000_000].map((total, index) => ({ date: `2026-07-${String(index + 1).padStart(2, "0")}`, total, cost: 0 })),
    streak: 4,
  };
  const animated = renderActivity(stats, { anim: true, chart: "skyline", sky: "night" });
  assert.match(animated, /\.skyline-building-grow\{clip-path:inset\(100% 0 0 0\) fill-box;animation:skylineBuildingGrow/);
  assert.match(animated, /@keyframes skylineBuildingGrow\{to\{clip-path:inset\(0 0 0 0\) fill-box\}\}/);
  const stages = [...animated.matchAll(/<g class="skyline-building-stage" data-building-id="([^"]+)" clip-path="url\(#(skylineClip[^\)]+)\)"><g class="skyline-building-grow" style="animation-delay:([0-9.]+)s"><path class="skyline-building [^"]+" d="([^"]+)"/g)];
  assert.ok(stages.length > 0);
  for (const [, buildingId, clipId, stageDelay, path] of stages) {
    assert.equal(clipId, `skylineClip${buildingId}`);
    assert.match(animated, new RegExp(`<clipPath id="${clipId}"><path d="${path}"/>`));
    assert.ok(Number(stageDelay) >= 0);
  }
  assert.match(animated, /<g class="skyline-building-grow" style="animation-delay:[0-9.]+s"><path class="skyline-building [^"]+"[^>]*\/><g class="skyline-facade">[\s\S]*?<g class="skyline-window-grid" data-build-order="bottom-up">/);
  assert.doesNotMatch(animated, /skyline-window-grow|skylineWindowBuild/);

  const staticSvg = renderActivity(stats, { anim: false, chart: "skyline", sky: "night" });
  assert.doesNotMatch(staticSvg, /skylineBuildingGrow|clip-path:inset\(/);
});

test("skyline stars stay in place and use a slow reduced-motion-safe twinkle", () => {
  const stats = {
    totals: { total: 2_000_000, cost: 1, input: 2_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: [{ date: "2026-07-01", total: 2_000_000, cost: 1 }],
    streak: 1,
  };
  const night = renderActivity(stats, { anim: true, chart: "skyline", sky: "night" });
  assert.match(night, /\.sky-star\{opacity:\.18;animation:skylineStarTwinkle 10\.00s ease-in-out infinite\}/);
  assert.match(night, /@keyframes skylineStarTwinkle\{0%,100%\{opacity:\.16\}50%\{opacity:\.52\}\}/);
  assert.doesNotMatch(night, /skylineStarTwinkle[^@]*transform:/);
  assert.match(night, /\.sky-star\{animation:none!important;opacity:\.3!important;transform:none!important\}/);
  const starDelays = [...night.matchAll(/class="sky-star" style="animation-delay:(-[0-9.]+)s"/g)].map((match) => Number(match[1]));
  assert.ok(starDelays.length > 0);
  assert.ok(starDelays.every((delay) => delay <= 0 && delay >= -10));

  const day = renderActivity(stats, { anim: true, chart: "skyline", sky: "day" });
  assert.doesNotMatch(day, /class="sky-star"/);
  const staticNight = renderActivity(stats, { anim: false, chart: "skyline", sky: "night" });
  assert.doesNotMatch(staticNight, /skylineStarTwinkle|animation-delay:-/);
});

test("skyline city readout uses only daily token activity and stays accessible when compact", () => {
  const byDay = [0, 12, 0, 8, 15, 21].map((total, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    total,
    cost: 0,
  }));
  const stats = {
    totals: { total: 56, cost: 0, input: 56, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay,
    // These intentionally disagree with byDay: a city must never present
    // cross-provider session history as a token-active streak.
    streak: 99,
    activeDays: 999,
  };
  const full = renderActivity(stats, { anim: false, chart: "skyline", sky: "day" });
  assert.match(full, /class="f skyline-readout\b[^>]+data-active-days="4"[^>]+data-window-days="6"[^>]+data-token-streak="3"/);
  assert.match(full, /DAILY TOKENS · 4\/6 ACTIVE · 3D STREAK/);
  assert.match(full, /class="f skyline-greenway"[^>]+data-token-streak="3"/);
  assert.match(full, /<title>3-day token streak<\/title>/);
  assert.doesNotMatch(full, /\b(?:GitHub|PR|contribution|language)\b/i);

  const compact = renderSummaryCompact(stats, { anim: false, chart: "skyline", sky: "day" });
  assert.doesNotMatch(compact, /skyline-readout|skyline-greenway/);
  assert.match(compact, /<desc>Building height represents daily tokens\. This 6-day window has 4 token-active days\./);
  assert.match(compact, /3d token streak/);

  const noTrailingRun = renderActivity({ ...stats, byDay: [...byDay.slice(0, -1), { ...byDay.at(-1), total: 0 }], streak: 50 }, { anim: false, chart: "skyline", sky: "day" });
  assert.match(noTrailingRun, /data-token-streak="0"/);
  assert.doesNotMatch(noTrailingRun, /skyline-greenway/);

  const windowFilled = { ...stats, byDay: byDay.slice(3), streak: 500 };
  const lowerBound = renderActivity(windowFilled, { anim: false, chart: "skyline", sky: "day" });
  assert.match(lowerBound, /≥3D STREAK/);
  assert.match(lowerBound, /The token streak spans this entire window, so it is at least 3 days\./);
  const lowerBoundCompact = renderSummaryCompact(windowFilled, { anim: false, chart: "skyline", sky: "day" });
  assert.match(lowerBoundCompact, /≥3d token streak/);
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
  assert.ok(landmarks.length <= 1);
});

test("a completely even skyline stays a city district without forced landmarks", () => {
  const stats = {
    totals: { total: 1, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, total: 500, cost: 0 })),
    streak: 0,
  };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", sky: "day" });
  assert.doesNotMatch(svg, /skyline-landmark/);
  assert.match(svg, /skyline-house/);
});

test("continuous skyline stays deterministic and valid across history lengths", () => {
  for (const count of [1, 5, 30, 180, 365]) {
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

test("rendered SVG escapes attribute titles and hostile date labels", () => {
  const stats = {
    totals: { total: 10, cost: 0, input: 10, output: 0, cacheRead: 0, cacheWrite: 0 },
    byDay: [{ date: '<script>&"', total: 10, cost: 0 }],
    streak: 1,
  };
  const svg = renderActivity(stats, { anim: false, chart: "skyline", title: 'A "quoted" & <unsafe> title' });
  assert.match(svg, /aria-label="A &quot;quoted&quot; &amp; &lt;unsafe&gt; title\. Building height represents daily tokens\./);
  assert.match(svg, /&lt;script&gt;&amp;"/);
  assert.doesNotMatch(svg, /<script>/);
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
