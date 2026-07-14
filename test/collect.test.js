import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { aggregate, collectAntigravitySessions, collectCodexSessions, collectEntries, filterHistoryByProvider, loadHistory, mergeHistory, saveHistory, toDayRecords } from "../src/collect.js";

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

test("partially migrated history preserves unassigned legacy Claude sessions", () => {
  const history = {
    version: 1,
    days: {
      "2026-07-13": {
        models: { "claude-sonnet-4-6": { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, total: 10, count: 1 } },
        projects: {},
        sessions: ["claude-old", "codex-new"],
        agentSessions: { codex: ["codex-new"] },
      },
    },
  };
  assert.deepEqual(aggregate(history).byAgentActivity, [
    { name: "claude-code", sessions: 1, activeDays: 1 },
    { name: "codex", sessions: 1, activeDays: 1 },
  ]);
});

test("history is readable after atomic save", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-"));
  const file = path.join(dir, "history.json");
  saveHistory({ version: 1, timezone: "UTC", days: {} }, file);
  assert.deepEqual(loadHistory(file), { version: 1, timezone: "UTC", days: {} });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("history saves merge stale snapshots instead of losing another process's days", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-merge-"));
  const file = path.join(dir, "history.json");
  try {
    saveHistory({ version: 1, timezone: "UTC", days: { "2026-07-12": toDayRecords([{ ts: "2026-07-12T10:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Codex", sessionId: "codex-1", agent: "codex" }], { timeZone: "UTC" })["2026-07-12"] } }, file);
    saveHistory({ version: 1, timezone: "UTC", days: { "2026-07-13": toDayRecords([{ ts: "2026-07-13T10:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Antigravity", sessionId: "anti-1", agent: "antigravity" }], { timeZone: "UTC" })["2026-07-13"] } }, file);
    assert.deepEqual(Object.keys(loadHistory(file).days).sort(), ["2026-07-12", "2026-07-13"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("parallel history writers serialize and preserve every provider snapshot", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-parallel-"));
  const file = path.join(dir, "history.json");
  const collectUrl = pathToFileURL(path.resolve("src/collect.js")).href;
  const runWriter = (index) => new Promise((resolve, reject) => {
    const day = `2026-07-${String(index + 1).padStart(2, "0")}`;
    const script = `import { saveHistory } from ${JSON.stringify(collectUrl)}; saveHistory({version:1,timezone:"UTC",days:{${JSON.stringify(day)}:{models:{},projects:{},agents:{},sessions:[${JSON.stringify(`session-${index}`)}],agentSessions:{codex:[${JSON.stringify(`session-${index}`)}]}}}},${JSON.stringify(file)});`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `writer exited ${code}`)));
  });
  try {
    await Promise.all(Array.from({ length: 6 }, (_, index) => runWriter(index)));
    const history = loadHistory(file);
    assert.equal(Object.keys(history.days).length, 6);
    assert.equal(aggregate(history).sessions, 6);
    assert.equal(fs.existsSync(`${file}.lock`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed and unsupported history is reported without being overwritten", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-corrupt-"));
  const file = path.join(dir, "history.json");
  try {
    const corrupt = "{not-json";
    fs.writeFileSync(file, corrupt);
    assert.throws(() => loadHistory(file), /Cannot read token-stack history/);
    assert.throws(() => saveHistory({ version: 1, timezone: "UTC", days: {} }, file), /Cannot read token-stack history/);
    assert.equal(fs.readFileSync(file, "utf8"), corrupt);
    assert.equal(fs.existsSync(`${file}.lock`), false);

    fs.writeFileSync(file, JSON.stringify({ version: 99, days: {} }));
    assert.throws(() => loadHistory(file), /unsupported or malformed history schema/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale history lock is recovered", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-stale-lock-"));
  const file = path.join(dir, "history.json");
  const lock = `${file}.lock`;
  try {
    fs.writeFileSync(lock, "abandoned");
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    saveHistory({ version: 1, timezone: "UTC", days: {} }, file);
    assert.deepEqual(loadHistory(file), { version: 1, timezone: "UTC", days: {} });
    assert.equal(fs.existsSync(lock), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale lock owned by a live process is not stolen", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-live-lock-"));
  const file = path.join(dir, "history.json");
  const lock = `${file}.lock`;
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token: "still-running", createdAt: Date.now() - 60_000 }));
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    assert.throws(
      () => saveHistory({ version: 1, timezone: "UTC", days: {} }, file, { lockOptions: { attempts: 2, delay: 1, staleAfter: 1 } }),
      /Timed out waiting/,
    );
    assert.equal(JSON.parse(fs.readFileSync(lock, "utf8")).token, "still-running");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("history replacement retries transient Windows-style file locks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-retry-"));
  const file = path.join(dir, "history.json");
  const rename = fs.renameSync;
  let attempts = 0;
  try {
    fs.renameSync = (...args) => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error("temporarily locked"), { code: "EPERM" });
      return rename(...args);
    };
    saveHistory({ version: 1, timezone: "UTC", days: {} }, file);
    assert.equal(attempts, 3);
    assert.deepEqual(loadHistory(file), { version: 1, timezone: "UTC", days: {} });
  } finally {
    fs.renameSync = rename;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("history keeps its first timezone and rejects a conflicting writer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-history-timezone-"));
  const file = path.join(dir, "history.json");
  try {
    saveHistory({ version: 1, timezone: "Asia/Seoul", days: {} }, file);
    assert.equal(loadHistory(file).timezone, "Asia/Seoul");
    assert.throws(() => saveHistory({ version: 1, timezone: "Pacific/Honolulu", days: {} }, file), /History timezone mismatch/);
    assert.equal(loadHistory(file).timezone, "Asia/Seoul");
    assert.equal(fs.existsSync(`${file}.lock`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("history merge preserves provider session unions independently of token snapshots", () => {
  const oldEntries = [
    { ts: "2026-07-13T08:00:00Z", model: "claude-sonnet-4-6", input: 100, output: 0, cacheRead: 0, cacheWrite: 0, project: "demo", sessionId: "claude-old", agent: "claude-code" },
    { ts: "2026-07-13T09:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Codex", sessionId: "codex-kept", agent: "codex" },
    { ts: "2026-07-13T10:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Antigravity", sessionId: "anti-kept", agent: "antigravity" },
  ];
  const currentEntries = [
    { ts: "2026-07-13T11:00:00Z", model: "claude-sonnet-4-6", input: 50, output: 0, cacheRead: 0, cacheWrite: 0, project: "demo", sessionId: "claude-new", agent: "claude-code" },
    { ts: "2026-07-13T12:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Codex", sessionId: "codex-new", agent: "codex" },
  ];
  const history = { version: 1, timezone: "UTC", days: toDayRecords(oldEntries, { timeZone: "UTC" }) };
  mergeHistory(history, toDayRecords(currentEntries, { timeZone: "UTC" }));
  const stats = aggregate(history);
  assert.equal(stats.totals.total, 100);
  assert.equal(stats.sessions, 5);
  assert.deepEqual(stats.byAgentActivity.map(({ name, sessions }) => ({ name, sessions })), [
    { name: "claude-code", sessions: 2 },
    { name: "codex", sessions: 2 },
    { name: "antigravity", sessions: 1 },
  ]);
});

test("provider history views isolate Claude, Codex, and Antigravity activity", () => {
  const entries = [
    { ts: "2026-07-13T08:00:00Z", model: "claude-sonnet-4-6", input: 100, output: 20, cacheRead: 0, cacheWrite: 0, project: "demo", sessionId: "same-id", agent: "claude-code" },
    { ts: "2026-07-13T09:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Codex", sessionId: "same-id", agent: "codex" },
    { ts: "2026-07-13T10:00:00Z", model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, project: "Antigravity", sessionId: "anti-1", agent: "antigravity" },
  ];
  const history = { version: 1, timezone: "UTC", days: toDayRecords(entries, { timeZone: "UTC" }) };
  const claude = aggregate(filterHistoryByProvider(history, "claude"));
  const codex = aggregate(filterHistoryByProvider(history, "codex"));
  const antigravity = aggregate(filterHistoryByProvider(history, "antigravity"));
  assert.equal(claude.totals.total, 120);
  assert.deepEqual(claude.byAgentActivity.map((item) => item.name), ["claude-code"]);
  assert.equal(codex.totals.total, 0);
  assert.deepEqual(codex.byAgentActivity, [{ name: "codex", sessions: 1, activeDays: 1 }]);
  assert.deepEqual(antigravity.byAgentActivity, [{ name: "antigravity", sessions: 1, activeDays: 1 }]);
  assert.equal(aggregate(history).sessions, 3);
});

test("collectors reject invalid timestamps and non-numeric or negative token fields", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-malformed-"));
  const project = path.join(root, "project");
  fs.mkdirSync(project);
  const rows = [
    { timestamp: "not-a-date", requestId: "bad-time", message: { id: "bad-time", model: "claude-sonnet-4-6", usage: { input_tokens: 50 } } },
    { timestamp: {}, requestId: "bad-object-time", message: { id: "bad-object-time", model: "claude-sonnet-4-6", usage: { input_tokens: 50 } } },
    { timestamp: "2026-07-13T10:00:00Z", requestId: "bad-values", message: { id: "bad-values", model: "claude-sonnet-4-6", usage: { input_tokens: "90", output_tokens: -2, cache_read_input_tokens: 10 } } },
  ];
  fs.writeFileSync(path.join(project, "session.jsonl"), rows.map((row) => JSON.stringify(row)).join("\n"));
  const entries = collectEntries(root);
  assert.equal(entries.length, 1);
  assert.deepEqual({ input: entries[0].input, output: entries[0].output, cacheRead: entries[0].cacheRead }, { input: 0, output: 0, cacheRead: 10 });
  assert.doesNotMatch(JSON.stringify(toDayRecords(entries)), /NaN/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("calendar-day grouping is stable in the history timezone", () => {
  const beforeMidnightUtc = [{ ts: "2026-07-14T00:30:00Z", agent: "codex", sessionId: "session", input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }];
  assert.deepEqual(Object.keys(toDayRecords(beforeMidnightUtc, { timeZone: "UTC" })), ["2026-07-14"]);
  assert.deepEqual(Object.keys(toDayRecords(beforeMidnightUtc, { timeZone: "America/Los_Angeles" })), ["2026-07-13"]);
  assert.deepEqual(Object.keys(toDayRecords([{ ...beforeMidnightUtc[0], ts: "2026-07-13T16:30:00Z" }], { timeZone: "Asia/Seoul" })), ["2026-07-14"]);
  assert.throws(() => toDayRecords(beforeMidnightUtc, { timeZone: "Mars/Olympus" }), /Unsupported history timezone/);
  assert.equal(aggregate({ version: 1, timezone: "UTC", days: {} }, { days: Number.MAX_SAFE_INTEGER }).byDay.length, 3650);
});

test("Codex collector ignores malformed session metadata without crashing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-codex-malformed-"));
  try {
    fs.writeFileSync(path.join(root, "rollout.jsonl"), `${JSON.stringify({ timestamp: "2026-07-13T10:00:00Z", type: "session_meta", payload: { session_id: ["bad"], cwd: 42 } })}\n`);
    const entries = collectCodexSessions(root);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].sessionId, "rollout");
    assert.equal(entries[0].project, "Codex");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
