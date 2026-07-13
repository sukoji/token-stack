import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { bucketCost } from "./pricing.js";

export function defaultSourceDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(base, "projects");
}

export function defaultHistoryFile() {
  return path.join(os.homedir(), ".token-stack", "history.json");
}

export function defaultCodexSourceDir() {
  return path.join(os.homedir(), ".codex", "sessions");
}

export function defaultAntigravitySourceDir() {
  return path.join(os.homedir(), ".gemini", "antigravity", "brain");
}

function* walkJsonl(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJsonl(full);
    else if (e.name.endsWith(".jsonl") && e.name !== "journal.jsonl") yield full;
  }
}

function projectNameFromSlug(slug) {
  // Slugs encode paths, e.g. "C--Users-piai-Desktop-song" -> "song"
  const parts = slug.split("-").filter(Boolean);
  return parts[parts.length - 1] || slug;
}

// Reads every session transcript and returns one record per API response.
export function collectEntries(sourceDir = defaultSourceDir(), { agent = "claude-code" } = {}) {
  const seen = new Set();
  const entries = [];
  for (const file of walkJsonl(sourceDir)) {
    const slug = path.relative(sourceDir, file).split(path.sep)[0];
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line || !line.includes('"usage"')) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const msg = obj.message;
      const u = msg && msg.usage;
      if (!u || !obj.timestamp) continue;
      const input = u.input_tokens || 0;
      const output = u.output_tokens || 0;
      const cacheRead = u.cache_read_input_tokens || 0;
      const cacheWrite = u.cache_creation_input_tokens || 0;
      if (input + output + cacheRead + cacheWrite === 0) continue;
      const model = msg.model || "";
      if (model === "<synthetic>") continue;
      // Streaming writes the same message several times; requestId+message.id
      // identifies one billed API response.
      const key = msg.id && obj.requestId ? `${msg.id}:${obj.requestId}` : obj.uuid;
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      entries.push({
        ts: obj.timestamp,
        model,
        input,
        output,
        cacheRead,
        cacheWrite,
        project: projectNameFromSlug(slug),
        sessionId: obj.sessionId,
        agent,
      });
    }
  }
  return entries;
}

// Codex session files expose session/activity events, but not the billed
// input/output/cache usage that Claude transcripts expose. Return one zero-token
// entry per session so it participates only in session-based agent activity.
export function collectCodexSessions(sourceDir = defaultCodexSourceDir()) {
  const entries = [];
  for (const file of walkJsonl(sourceDir)) {
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    let sessionId = path.basename(file, ".jsonl");
    let latestTs = "";
    let project = "Codex";
    for (const line of text.split("\n")) {
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.timestamp && obj.timestamp > latestTs) latestTs = obj.timestamp;
      if (obj.type === "session_meta") {
        sessionId = obj.payload?.session_id || obj.payload?.id || sessionId;
        if (obj.payload?.cwd) project = path.basename(obj.payload.cwd) || project;
      }
    }
    if (!latestTs) continue;
    entries.push({
      ts: latestTs, model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
      project, sessionId, agent: "codex",
    });
  }
  return entries;
}

// Antigravity keeps one transcript.jsonl under each brain UUID. Its event
// schema contains activity timestamps but no provider-comparable token totals.
export function collectAntigravitySessions(sourceDir = defaultAntigravitySourceDir()) {
  const entries = [];
  for (const file of walkJsonl(sourceDir)) {
    if (path.basename(file) !== "transcript.jsonl") continue;
    const sessionId = path.relative(sourceDir, file).split(path.sep)[0];
    if (!sessionId) continue;
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    let latestTs = "";
    for (const line of text.split("\n")) {
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const timestamp = obj.created_at || obj.timestamp;
      if (timestamp && timestamp > latestTs) latestTs = timestamp;
    }
    if (!latestTs) continue;
    entries.push({
      ts: latestTs, model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
      project: "Antigravity", sessionId, agent: "antigravity",
    });
  }
  return entries;
}

function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyBucket() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, count: 0 };
}

function add(bucket, e) {
  bucket.input += e.input;
  bucket.output += e.output;
  bucket.cacheRead += e.cacheRead;
  bucket.cacheWrite += e.cacheWrite;
  bucket.total += e.input + e.output + e.cacheRead + e.cacheWrite;
  bucket.count += 1;
}

const dayTotal = (rec) =>
  Object.values(rec.models).reduce((a, b) => a + b.total, 0);

// Groups raw entries into one record per calendar day — the unit stored in
// the history snapshot.
export function toDayRecords(entries) {
  const days = {};
  for (const e of entries) {
    const day = (days[dayKey(e.ts)] ??= { models: {}, projects: {}, agents: {}, sessions: [], agentSessions: {} });
    if (e.input + e.output + e.cacheRead + e.cacheWrite > 0) {
      add((day.models[e.model || "unknown"] ??= emptyBucket()), e);
      add((day.projects[e.project] ??= emptyBucket()), e);
    }
    add((day.agents[e.agent || "unknown"] ??= emptyBucket()), e);
    if (e.sessionId && !day.sessions.includes(e.sessionId)) day.sessions.push(e.sessionId);
    if (e.sessionId) {
      const sessions = (day.agentSessions[e.agent || "unknown"] ??= []);
      if (!sessions.includes(e.sessionId)) sessions.push(e.sessionId);
    }
  }
  return days;
}

// History snapshot: survives Claude Code's transcript cleanup (~30 days).
// A day is replaced only when the fresh scan has at least as many tokens for
// it — days that shrank or vanished from disk keep their stored record.
export function loadHistory(file = defaultHistoryFile()) {
  try {
    const h = JSON.parse(fs.readFileSync(file, "utf8"));
    if (h && h.version === 1 && h.days) return h;
  } catch {}
  return { version: 1, days: {} };
}

export function mergeHistory(history, currentDays) {
  for (const [day, rec] of Object.entries(currentDays)) {
    const old = history.days[day];
    if (!old || dayTotal(rec) >= dayTotal(old)) history.days[day] = rec;
    else {
      old.agentSessions ??= {};
      for (const [agent, ids] of Object.entries(rec.agentSessions ?? {})) {
        old.agentSessions[agent] = [...new Set([...(old.agentSessions[agent] ?? []), ...ids])];
        old.agents ??= {};
        if (!old.agents[agent]) old.agents[agent] = rec.agents[agent];
      }
    }
  }
  return history;
}

export function saveHistory(history, file = defaultHistoryFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(history));
  fs.renameSync(temp, file);
}

export function aggregate(history, { days = 30 } = {}) {
  const totals = { ...emptyBucket(), cost: 0 };
  const byModel = new Map();
  const byProject = new Map();
  const byAgent = new Map();
  const agentSessionSets = new Map();
  const agentActiveDays = new Map();
  const sessions = new Set();
  const dayKeys = Object.keys(history.days).sort();

  const merge = (map, key, b) => {
    const t = map.get(key) ?? emptyBucket();
    for (const k of Object.keys(t)) t[k] += b[k];
    map.set(key, t);
  };

  for (const day of dayKeys) {
    const rec = history.days[day];
    for (const [model, b] of Object.entries(rec.models)) merge(byModel, model, b);
    for (const [proj, b] of Object.entries(rec.projects)) merge(byProject, proj, b);
    // Snapshots written before agent tracking are Claude Code data by definition.
    const legacyAgent = Object.values(rec.models).reduce((sum, bucket) => {
      add(sum, bucket);
      return sum;
    }, emptyBucket());
    for (const [agent, b] of Object.entries(rec.agents ?? { "claude-code": legacyAgent })) merge(byAgent, agent, b);
    const legacySessions = rec.sessions?.length ? { "claude-code": rec.sessions } : {};
    for (const [agent, ids] of Object.entries(rec.agentSessions ?? legacySessions)) {
      const set = agentSessionSets.get(agent) ?? new Set();
      for (const id of ids) set.add(id);
      agentSessionSets.set(agent, set);
      if (ids.length) agentActiveDays.set(agent, (agentActiveDays.get(agent) ?? 0) + 1);
    }
    for (const s of rec.sessions) sessions.add(s);
  }
  for (const [model, b] of byModel) {
    for (const k of Object.keys(emptyBucket())) totals[k] += b[k];
    totals.cost += bucketCost(model, b);
  }

  // Last `days` calendar days, oldest first, empty days included.
  const byDay = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    const rec = history.days[key];
    let total = 0, cost = 0;
    if (rec) {
      for (const [model, b] of Object.entries(rec.models)) {
        total += b.total;
        cost += bucketCost(model, b);
      }
    }
    byDay.push({ date: key, total, cost });
  }

  // Streak of consecutive active days ending today (or yesterday).
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (history.days[dayKey(d)]) streak++;
    else if (i === 0) continue; // today can still be empty
    else break;
  }

  const sortDesc = (map) =>
    [...map.entries()]
      .map(([name, v]) => ({ name, ...v, cost: bucketCost(name, v) }))
      .sort((a, b) => b.total - a.total);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    byModel: sortDesc(byModel),
    byProject: [...byProject.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
    byAgent: sortDesc(byAgent),
    byAgentActivity: [...agentSessionSets.entries()]
      .map(([name, ids]) => ({ name, sessions: ids.size, activeDays: agentActiveDays.get(name) ?? 0 }))
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name)),
    agentSessions: [...agentSessionSets.values()].reduce((sum, ids) => sum + ids.size, 0),
    byDay,
    activeDays: dayKeys.length,
    streak,
    sessions: sessions.size,
    firstDay: dayKeys[0] ?? null,
  };
}
