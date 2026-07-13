import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aggregate, collectEntries, loadHistory, saveHistory, toDayRecords } from "../src/collect.js";

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
  fs.rmSync(dir, { recursive: true, force: true });
});

test("history is readable after atomic save", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-"));
  const file = path.join(dir, "history.json");
  saveHistory({ version: 1, days: {} }, file);
  assert.deepEqual(loadHistory(file), { version: 1, days: {} });
  fs.rmSync(dir, { recursive: true, force: true });
});
