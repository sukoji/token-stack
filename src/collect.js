import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
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

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function timestampMillis(value) {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

const dayFormatters = new Map();

function canonicalTimeZone(value) {
  if (typeof value !== "string" || !value) throw new Error("history timezone must be a non-empty IANA timezone");
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    throw new Error(`Unsupported history timezone "${value}"`);
  }
}

export function currentTimeZone() {
  return canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
}

function formatterFor(timeZone) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "iso8601",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter;
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
      if (timestampMillis(obj.timestamp) === null) continue;
      const input = positiveNumber(u.input_tokens);
      const output = positiveNumber(u.output_tokens);
      const cacheRead = positiveNumber(u.cache_read_input_tokens);
      const cacheWrite = positiveNumber(u.cache_creation_input_tokens);
      if (input + output + cacheRead + cacheWrite === 0) continue;
      const model = typeof msg.model === "string" && msg.model ? msg.model : "unknown";
      if (model === "<synthetic>") continue;
      // Streaming writes the same message several times; requestId+message.id
      // identifies one billed API response.
      const key = typeof msg.id === "string" && typeof obj.requestId === "string"
        ? `${msg.id}:${obj.requestId}`
        : typeof obj.uuid === "string" ? obj.uuid : null;
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
        sessionId: typeof obj.sessionId === "string" && obj.sessionId ? obj.sessionId : undefined,
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
    let latestMs = -Infinity;
    let project = "Codex";
    for (const line of text.split("\n")) {
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const time = timestampMillis(obj.timestamp);
      if (time !== null && time > latestMs) {
        latestMs = time;
        latestTs = obj.timestamp;
      }
      if (obj.type === "session_meta") {
        const id = [obj.payload?.session_id, obj.payload?.id].find((value) => typeof value === "string" && value);
        const cwd = obj.payload?.cwd;
        if (typeof id === "string" && id) sessionId = id;
        if (typeof cwd === "string" && cwd) project = path.basename(cwd) || project;
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
    let latestMs = -Infinity;
    for (const line of text.split("\n")) {
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const timestamp = obj.created_at || obj.timestamp;
      const time = timestampMillis(timestamp);
      if (time !== null && time > latestMs) {
        latestMs = time;
        latestTs = timestamp;
      }
    }
    if (!latestTs) continue;
    entries.push({
      ts: latestTs, model: "", input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
      project: "Antigravity", sessionId, agent: "antigravity",
    });
  }
  return entries;
}

function dayKey(ts, timeZone) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(d).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isDayKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function shiftDayKey(value, offset) {
  if (!isDayKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function emptyBucket() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, count: 0 };
}

function add(bucket, e) {
  const input = positiveNumber(e?.input);
  const output = positiveNumber(e?.output);
  const cacheRead = positiveNumber(e?.cacheRead);
  const cacheWrite = positiveNumber(e?.cacheWrite);
  bucket.input += input;
  bucket.output += output;
  bucket.cacheRead += cacheRead;
  bucket.cacheWrite += cacheWrite;
  bucket.total += input + output + cacheRead + cacheWrite;
  bucket.count += positiveNumber(e?.count) || 1;
}

const dayTotal = (rec) =>
  Object.values(rec?.models ?? {}).reduce((a, b) => a + positiveNumber(b?.total), 0);

// Groups raw entries into one record per calendar day — the unit stored in
// the history snapshot.
export function toDayRecords(entries, { timeZone = currentTimeZone() } = {}) {
  const zone = canonicalTimeZone(timeZone);
  const days = {};
  for (const e of entries) {
    const key = dayKey(e.ts, zone);
    if (!key) continue;
    const model = typeof e.model === "string" && e.model ? e.model : "unknown";
    const project = typeof e.project === "string" && e.project ? e.project : "unknown";
    const agent = typeof e.agent === "string" && e.agent ? e.agent : "unknown";
    const sessionId = typeof e.sessionId === "string" && e.sessionId ? e.sessionId : null;
    const tokenTotal = positiveNumber(e.input) + positiveNumber(e.output) + positiveNumber(e.cacheRead) + positiveNumber(e.cacheWrite);
    const day = (days[key] ??= { models: {}, projects: {}, agents: {}, sessions: [], agentSessions: {} });
    if (tokenTotal > 0) {
      add((day.models[model] ??= emptyBucket()), e);
      add((day.projects[project] ??= emptyBucket()), e);
    }
    add((day.agents[agent] ??= emptyBucket()), e);
    if (sessionId && !day.sessions.includes(sessionId)) day.sessions.push(sessionId);
    if (sessionId) {
      const sessions = (day.agentSessions[agent] ??= []);
      if (!sessions.includes(sessionId)) sessions.push(sessionId);
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
    if (!h || h.version !== 1 || !h.days || typeof h.days !== "object" || Array.isArray(h.days)) {
      throw new Error("unsupported or malformed history schema");
    }
    if (h.timezone !== undefined) h.timezone = canonicalTimeZone(h.timezone);
    return h;
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, days: {} };
    throw new Error(`Cannot read token-stack history at ${file}: ${error.message}`, { cause: error });
  }
}

function legacyAgentBucket(rec) {
  const bucket = emptyBucket();
  for (const value of Object.values(rec?.models ?? {})) {
    for (const key of Object.keys(bucket)) bucket[key] += positiveNumber(value?.[key]);
  }
  return bucket;
}

function recordAgentSessions(rec) {
  const result = {};
  if (rec?.agentSessions && typeof rec.agentSessions === "object") {
    for (const [agent, ids] of Object.entries(rec.agentSessions)) {
      result[agent] = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id))];
    }
  }
  if (Array.isArray(rec?.sessions) && rec.sessions.length) {
    const assigned = new Set(Object.values(result).flat());
    const legacyClaude = [...new Set(rec.sessions.filter((id) => typeof id === "string" && id && !assigned.has(id)))];
    if (legacyClaude.length) result["claude-code"] = [...new Set([...(result["claude-code"] ?? []), ...legacyClaude])];
  }
  return result;
}

function recordAgents(rec) {
  const result = { ...(rec?.agents ?? {}) };
  if (!result["claude-code"] && dayTotal(rec) > 0) result["claude-code"] = legacyAgentBucket(rec);
  return result;
}

function preferredBucket(left, right) {
  if (!left) return right;
  if (!right) return left;
  const leftTotal = positiveNumber(left.total);
  const rightTotal = positiveNumber(right.total);
  if (rightTotal !== leftTotal) return rightTotal > leftTotal ? right : left;
  return positiveNumber(right.count) > positiveNumber(left.count) ? right : left;
}

export function mergeHistory(history, currentDays) {
  history.days ??= {};
  for (const [day, rec] of Object.entries(currentDays)) {
    const old = history.days[day];
    if (!old) {
      const agentSessions = recordAgentSessions(rec);
      history.days[day] = {
        ...rec,
        models: rec.models ?? {},
        projects: rec.projects ?? {},
        agents: recordAgents(rec),
        agentSessions,
        sessions: [...new Set([...(rec.sessions ?? []), ...Object.values(agentSessions).flat()])],
      };
      continue;
    }

    const tokenSource = dayTotal(rec) >= dayTotal(old) ? rec : old;
    const oldSessions = recordAgentSessions(old);
    const newSessions = recordAgentSessions(rec);
    const agentSessions = {};
    for (const agent of new Set([...Object.keys(oldSessions), ...Object.keys(newSessions)])) {
      agentSessions[agent] = [...new Set([...(oldSessions[agent] ?? []), ...(newSessions[agent] ?? [])])];
    }
    const oldAgents = recordAgents(old);
    const newAgents = recordAgents(rec);
    const agents = {};
    for (const agent of new Set([...Object.keys(oldAgents), ...Object.keys(newAgents)])) {
      agents[agent] = preferredBucket(oldAgents[agent], newAgents[agent]);
    }
    history.days[day] = {
      ...tokenSource,
      models: tokenSource.models ?? {},
      projects: tokenSource.projects ?? {},
      agents,
      agentSessions,
      sessions: [...new Set([...(old.sessions ?? []), ...(rec.sessions ?? []), ...Object.values(agentSessions).flat()])],
    };
  }
  return history;
}

export function filterHistoryByProvider(history, provider) {
  if (provider === "auto") return history;
  const agent = provider === "claude" ? "claude-code" : provider;
  const days = {};
  for (const [day, rec] of Object.entries(history.days ?? {})) {
    const sessions = recordAgentSessions(rec)[agent] ?? [];
    const agentBucket = recordAgents(rec)[agent];
    const tokenBearing = agent === "claude-code" && dayTotal(rec) > 0;
    if (!tokenBearing && !sessions.length && !agentBucket) continue;
    days[day] = {
      models: tokenBearing ? rec.models ?? {} : {},
      projects: tokenBearing ? rec.projects ?? {} : {},
      agents: agentBucket ? { [agent]: agentBucket } : {},
      sessions: [...sessions],
      agentSessions: sessions.length ? { [agent]: [...sessions] } : {},
    };
  }
  return { version: 1, ...(history.timezone ? { timezone: canonicalTimeZone(history.timezone) } : {}), days };
}

const waitArray = new Int32Array(new SharedArrayBuffer(4));

function waitForLock(milliseconds) {
  Atomics.wait(waitArray, 0, 0, milliseconds);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function staleLockCanBeRemoved(lockFile, staleAfter) {
  if (Date.now() - fs.statSync(lockFile).mtimeMs <= staleAfter) return false;
  try {
    const owner = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    return !processIsAlive(owner?.pid);
  } catch {
    return true;
  }
}

function removeOwnedLock(lockFile, token) {
  try {
    const owner = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (owner?.token === token) fs.rmSync(lockFile, { force: true });
  } catch {}
}

function acquireHistoryLock(lockFile, { attempts = 100, delay = 20, staleAfter = 30_000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let fd;
    try {
      fd = fs.openSync(lockFile, "wx");
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (staleLockCanBeRemoved(lockFile, staleAfter)) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch (statError) {
        if (statError?.code === "ENOENT") continue;
        throw statError;
      }
      if (attempt < attempts - 1) waitForLock(delay);
      continue;
    }
    const token = randomUUID();
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, createdAt: Date.now() }));
      return { fd, token };
    } catch (error) {
      fs.closeSync(fd);
      fs.rmSync(lockFile, { force: true });
      throw error;
    }
  }
  throw new Error(`Timed out waiting for another token-stack process to finish writing ${lockFile}`);
}

function replaceHistoryFile(temp, file, { attempts = 40, delay = 25 } = {}) {
  const transient = new Set(["EACCES", "EBUSY", "ENOTEMPTY", "EPERM"]);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      fs.renameSync(temp, file);
      return;
    } catch (error) {
      if (!transient.has(error?.code) || attempt === attempts - 1) throw error;
      waitForLock(delay);
    }
  }
}

export function saveHistory(history, file = defaultHistoryFile(), { lockOptions } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lockFile = `${file}.lock`;
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  let lock;
  try {
    lock = acquireHistoryLock(lockFile, lockOptions);
    const latest = loadHistory(file);
    const incomingZone = canonicalTimeZone(history?.timezone ?? currentTimeZone());
    const latestZone = latest.timezone ? canonicalTimeZone(latest.timezone) : incomingZone;
    if (latest.timezone && latestZone !== incomingZone) {
      throw new Error(`History timezone mismatch (${latestZone} on disk, ${incomingZone} in this process). Re-run token-stack so it can use the saved timezone.`);
    }
    const merged = mergeHistory({ version: 1, timezone: latestZone, days: { ...latest.days } }, history?.days ?? {});
    fs.writeFileSync(temp, JSON.stringify(merged));
    replaceHistoryFile(temp, file);
    return merged;
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
    if (lock !== undefined) {
      fs.closeSync(lock.fd);
      removeOwnedLock(lockFile, lock.token);
    }
  }
}

export function aggregate(history, { days = 30 } = {}) {
  days = Math.min(3650, Math.max(1, Math.trunc(Number(days)) || 30));
  const totals = { ...emptyBucket(), cost: 0 };
  const byModel = new Map();
  const byProject = new Map();
  const byAgent = new Map();
  const agentSessionSets = new Map();
  const agentActiveDays = new Map();
  const timeZone = canonicalTimeZone(history?.timezone ?? currentTimeZone());
  const dayKeys = Object.keys(history.days ?? {}).filter(isDayKey).sort();

  const merge = (map, key, b) => {
    const t = map.get(key) ?? emptyBucket();
    for (const k of Object.keys(t)) t[k] += positiveNumber(b?.[k]);
    map.set(key, t);
  };

  for (const day of dayKeys) {
    const rec = history.days[day] ?? {};
    for (const [model, b] of Object.entries(rec.models ?? {})) merge(byModel, model, b);
    for (const [proj, b] of Object.entries(rec.projects ?? {})) merge(byProject, proj, b);
    for (const [agent, b] of Object.entries(recordAgents(rec))) merge(byAgent, agent, b);
    for (const [agent, ids] of Object.entries(recordAgentSessions(rec))) {
      const set = agentSessionSets.get(agent) ?? new Set();
      for (const id of ids) set.add(id);
      agentSessionSets.set(agent, set);
      if (ids.length) agentActiveDays.set(agent, (agentActiveDays.get(agent) ?? 0) + 1);
    }
  }
  for (const [model, b] of byModel) {
    for (const k of Object.keys(emptyBucket())) totals[k] += b[k];
    totals.cost += bucketCost(model, b);
  }

  // Last `days` calendar days, oldest first, empty days included.
  const byDay = [];
  const today = dayKey(new Date(), timeZone);
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDayKey(today, -i);
    const rec = history.days[key];
    let total = 0, cost = 0;
    if (rec) {
      for (const [model, b] of Object.entries(rec.models ?? {})) {
        total += positiveNumber(b?.total);
        cost += bucketCost(model, b);
      }
    }
    byDay.push({ date: key, total, cost });
  }

  // Streak of consecutive active days ending today (or yesterday).
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = shiftDayKey(today, -i);
    if (history.days[key]) streak++;
    else if (i === 0) continue; // today can still be empty
    else break;
  }

  const sortDesc = (map) =>
    [...map.entries()]
      .map(([name, v]) => ({ name, ...v, cost: bucketCost(name, v) }))
      .sort((a, b) => b.total - a.total);

  const sessionCount = [...agentSessionSets.values()].reduce((sum, ids) => sum + ids.size, 0);
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
    agentSessions: sessionCount,
    byDay,
    activeDays: dayKeys.length,
    streak,
    sessions: sessionCount,
    firstDay: dayKeys[0] ?? null,
  };
}
