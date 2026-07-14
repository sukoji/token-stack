import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { saveHistory, toDayRecords } from "../src/collect.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "token-stack.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

test("CLI provider-only views stay isolated even when a shared history contains Claude data", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "token stack-검증-"));
  try {
    const historyFile = path.join(temp, "history.json");
    const claudeEntry = {
      ts: "2026-07-14T01:00:00Z", model: "claude-sonnet-4-6", input: 120, output: 30,
      cacheRead: 0, cacheWrite: 0, project: "demo", sessionId: "claude-1", agent: "claude-code",
    };
    saveHistory({ version: 1, days: toDayRecords([claudeEntry]) }, historyFile);

    const codexDir = path.join(temp, "Codex 세션", "2026", "07", "14");
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, "rollout.jsonl"), `${JSON.stringify({ timestamp: "2026-07-14T02:00:00Z", type: "session_meta", payload: { session_id: "codex-1", cwd: path.join(temp, "작업 공간") } })}\n`);

    const codex = run(["json", "--provider", "codex", "--codex-source", path.join(temp, "Codex 세션"), "--history", historyFile, "--days", "1"]);
    assert.equal(codex.status, 0, codex.stderr);
    const codexStats = JSON.parse(codex.stdout);
    assert.equal(codexStats.totals.total, 0);
    assert.deepEqual(codexStats.byAgentActivity, [{ name: "codex", sessions: 1, activeDays: 1 }]);
    assert.equal(codexStats.byAgent.some((item) => item.name === "claude-code"), false);

    const claude = run(["json", "--provider", "claude", "--source", path.join(temp, "missing Claude"), "--history", historyFile, "--days", "1"]);
    assert.equal(claude.status, 0, claude.stderr);
    const claudeStats = JSON.parse(claude.stdout);
    assert.equal(claudeStats.totals.total, 150);
    assert.deepEqual(claudeStats.byAgentActivity.map((item) => item.name), ["claude-code"]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("CLI no-data errors identify the selected provider and source", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-empty-provider-"));
  try {
    const result = run(["json", "--provider", "codex", "--codex-source", temp, "--no-history"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No Codex activity found/);
    assert.match(result.stderr, new RegExp(temp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(result.stderr, /Is Claude Code installed/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("CLI reports corrupt history without overwriting it or printing a stack trace", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-corrupt-cli-"));
  const history = path.join(temp, "history.json");
  const source = path.join(temp, "Claude source");
  try {
    fs.mkdirSync(source);
    fs.writeFileSync(history, "{broken-history");
    const result = run(["json", "--provider", "claude", "--source", source, "--history", history]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot read token-stack history/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
    assert.equal(fs.readFileSync(history, "utf8"), "{broken-history");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
