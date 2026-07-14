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
  assert.match(renderSummaryCompact(stats, { anim: false, chart: "skyline" }), /skylineSky/);
  const activity = renderActivity(stats, { anim: false, chart: "skyline" });
  assert.match(activity, /skylineMoon/);
  assert.match(activity, /skyline-field/);
  assert.match(activity, /skyline-house/);
  assert.match(activity, /skyline-midrise/);
  assert.match(activity, /skyline-landmark/);
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
