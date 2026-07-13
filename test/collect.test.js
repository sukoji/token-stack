import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aggregate, collectAntigravitySessions, collectCodexSessions, collectEntries, loadHistory, saveHistory, toDayRecords } from "../src/collect.js";

test("collects and de-duplicates Claude usage responses", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-test-"));
  const project = path.join(dir, "C--work-demo");
  fs.mkdirSync(project);
  const row = { timestamp: "2026-07-01T12:00:00Z", requestId: "request-1", sessionId: "session-1", message: { id: "message-1", model: "claude-sonnet-4-6", usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 } } };
  fs.writeFileSync(path.join(project, "session.jsonl"), `${JSON.stringify(row)}\n${JSON.stringify(row)}\n`);
  const entries = collectEntries(dir);
  assert.equal(entries.length, 1);
  const stats = aggregate({ version: 1, days: toDayRecords(entries) });
  assert.equal(stats.totals.total, 100);
  assert.equal(stats.sessions, 1);
  assert.equal(stats.byAgent[0].name, "claude-code");
  assert.deepEqual(stats.byAgentActivity, [{ name: "claude-code", sessions: 1, activeDays: 1 }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("collects provider activity using the documented Codex and Antigravity session shapes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-providers-"));
  const codex = path.join(root, "codex", "2026", "07", "13");
  const antigravity = path.join(root, "antigravity", "brain", "brain-1", ".system_generated", "logs");
  fs.mkdirSync(codex, { recursive: true });
  fs.mkdirSync(antigravity, { recursive: true });
  fs.writeFileSync(path.join(codex, "rollout.jsonl"), `${JSON.stringify({ timestamp: "2026-07-13T10:00:00Z", type: "session_meta", payload: { session_id: "codex-1", cwd: "/work/demo" } })}\n${JSON.stringify({ timestamp: "2026-07-13T10:02:00Z", type: "event_msg", payload: { type: "user_message" } })}\n`);
  fs.writeFileSync(path.join(antigravity, "transcript.jsonl"), `${JSON.stringify({ created_at: "2026-07-13T11:00:00Z", type: "USER_INPUT" })}\n`);
  const entries = [...collectCodexSessions(path.join(root, "codex")), ...collectAntigravitySessions(path.join(root, "antigravity", "brain"))];
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.agent).sort(), ["antigravity", "codex"]);
  const stats = aggregate({ version: 1, days: toDayRecords(entries) });
  assert.deepEqual(stats.byAgentActivity, [
    { name: "antigravity", sessions: 1, activeDays: 1 },
    { name: "codex", sessions: 1, activeDays: 1 },
  ]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("deduplicates provider sessions and preserves legacy Claude snapshots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-provider-dedupe-"));
  fs.mkdirSync(root, { recursive: true });
  const session = { timestamp: "2026-07-13T10:00:00Z", type: "session_meta", payload: { session_id: "same-session" } };
  fs.writeFileSync(path.join(root, "a.jsonl"), `${JSON.stringify(session)}\nnot-json\n`);
  fs.writeFileSync(path.join(root, "b.jsonl"), `${JSON.stringify(session)}\n`);
  const codex = collectCodexSessions(root);
  assert.equal(codex.length, 2);
  const codexStats = aggregate({ version: 1, days: toDayRecords(codex) });
  assert.deepEqual(codexStats.byAgentActivity, [{ name: "codex", sessions: 1, activeDays: 1 }]);
  const legacy = { version: 1, days: { "2026-07-01": { models: {}, projects: {}, sessions: ["legacy-session"] } } };
  assert.deepEqual(aggregate(legacy).byAgentActivity, [{ name: "claude-code", sessions: 1, activeDays: 1 }]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("history is readable after atomic save", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-"));
  const file = path.join(dir, "history.json");
  saveHistory({ version: 1, days: {} }, file);
  assert.deepEqual(loadHistory(file), { version: 1, days: {} });
  fs.rmSync(dir, { recursive: true, force: true });
});
